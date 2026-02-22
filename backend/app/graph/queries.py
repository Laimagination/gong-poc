"""Cypher query functions for the graph API endpoints."""

from __future__ import annotations

from .connection import get_driver


def _node_record(record, key="n") -> dict:
    """Convert a Neo4j node record to a dict with id, label, name, properties."""
    node = record[key]
    labels = list(node.labels)
    props = dict(node)
    return {
        "id": props.get("graph_id", ""),
        "label": labels[0] if labels else "Unknown",
        "name": props.get("name", props.get("graph_id", "")),
        "properties": props,
    }


def _rel_record(record) -> dict:
    """Convert a Neo4j relationship record to a link dict."""
    return {
        "source": record["source_id"],
        "target": record["target_id"],
        "type": record["rel_type"],
    }


async def get_full_graph() -> dict:
    """Return all nodes and relationships for visualization."""
    driver = get_driver()
    nodes = []
    links = []

    async with driver.session() as session:
        # All nodes
        result = await session.run("MATCH (n) RETURN n")
        async for record in result:
            nodes.append(_node_record(record))

        # All relationships
        result = await session.run(
            "MATCH (a)-[r]->(b) "
            "RETURN a.graph_id AS source_id, b.graph_id AS target_id, type(r) AS rel_type"
        )
        async for record in result:
            links.append(_rel_record(record))

    return {"nodes": nodes, "links": links}


async def get_department_subgraph(dept_id: str) -> dict:
    """Return a 3-hop neighborhood from a department node."""
    driver = get_driver()
    nodes = []
    links = []
    graph_id = f"Department-{dept_id}"

    async with driver.session() as session:
        # Get nodes within 3 hops
        result = await session.run(
            "MATCH (start:Department {graph_id: $gid}) "
            "MATCH path = (start)-[*1..3]-(connected) "
            "UNWIND nodes(path) AS n "
            "RETURN DISTINCT n",
            gid=graph_id,
        )
        seen_ids = set()
        async for record in result:
            nd = _node_record(record)
            if nd["id"] not in seen_ids:
                seen_ids.add(nd["id"])
                nodes.append(nd)

        # Get relationships between those nodes
        if seen_ids:
            result = await session.run(
                "MATCH (a)-[r]->(b) "
                "WHERE a.graph_id IN $ids AND b.graph_id IN $ids "
                "RETURN a.graph_id AS source_id, b.graph_id AS target_id, type(r) AS rel_type",
                ids=list(seen_ids),
            )
            async for record in result:
                links.append(_rel_record(record))

    return {"nodes": nodes, "links": links}


async def get_project_lineage(project_id: int) -> dict:
    """Return the Department → Workflow → Project → Controls → Framework lineage chain."""
    driver = get_driver()
    nodes = []
    links = []
    proj_gid = f"AIProject-{project_id}"

    async with driver.session() as session:
        # Traverse the lineage path
        result = await session.run(
            "MATCH (p:AIProject {graph_id: $gid}) "
            "OPTIONAL MATCH (p)-[:BELONGS_TO]->(d:Department) "
            "OPTIONAL MATCH (w:Workflow)-[:BECAME_PROJECT]->(p) "
            "OPTIONAL MATCH (p)-[:GOVERNED_BY]->(c:Control) "
            "OPTIONAL MATCH (c)-[:PART_OF]->(f:ControlFramework) "
            "OPTIONAL MATCH (w)-[:HAS_SCORE]->(s:WorkflowScore) "
            "OPTIONAL MATCH (w)-[:FOLLOWS_PRINCIPLE]->(pr:Principle) "
            "RETURN p, d, w, c, f, s, pr",
            gid=proj_gid,
        )

        seen_ids = set()
        raw_links = []

        async for record in result:
            for key in ["p", "d", "w", "c", "f", "s", "pr"]:
                node = record[key]
                if node is not None:
                    nd = _node_record(record, key)
                    if nd["id"] not in seen_ids:
                        seen_ids.add(nd["id"])
                        nodes.append(nd)

            # Build links from known relationships
            p_node = record["p"]
            d_node = record["d"]
            w_node = record["w"]
            c_node = record["c"]
            f_node = record["f"]
            s_node = record["s"]
            pr_node = record["pr"]

            if d_node and p_node:
                raw_links.append((dict(p_node)["graph_id"], dict(d_node)["graph_id"], "BELONGS_TO"))
            if w_node and p_node:
                raw_links.append((dict(w_node)["graph_id"], dict(p_node)["graph_id"], "BECAME_PROJECT"))
            if d_node and w_node:
                raw_links.append((dict(d_node)["graph_id"], dict(w_node)["graph_id"], "HAS_WORKFLOW"))
            if p_node and c_node:
                raw_links.append((dict(p_node)["graph_id"], dict(c_node)["graph_id"], "GOVERNED_BY"))
            if c_node and f_node:
                raw_links.append((dict(c_node)["graph_id"], dict(f_node)["graph_id"], "PART_OF"))
            if w_node and s_node:
                raw_links.append((dict(w_node)["graph_id"], dict(s_node)["graph_id"], "HAS_SCORE"))
            if w_node and pr_node:
                raw_links.append((dict(w_node)["graph_id"], dict(pr_node)["graph_id"], "FOLLOWS_PRINCIPLE"))

        # Deduplicate links
        seen_links = set()
        for src, tgt, rtype in raw_links:
            key = (src, tgt, rtype)
            if key not in seen_links:
                seen_links.add(key)
                links.append({"source": src, "target": tgt, "type": rtype})

    return {"nodes": nodes, "links": links}


async def get_graph_insights() -> dict:
    """Return cross-module insight data from the knowledge graph."""
    driver = get_driver()
    insights: dict = {}

    async with driver.session() as session:
        # 1. Governance Coverage — projects with vs without GOVERNED_BY
        result = await session.run(
            "MATCH (p:AIProject) "
            "OPTIONAL MATCH (p)-[:GOVERNED_BY]->(c:Control) "
            "WITH p, count(c) AS ctrl_count "
            "RETURN count(p) AS total, "
            "       sum(CASE WHEN ctrl_count > 0 THEN 1 ELSE 0 END) AS governed, "
            "       collect(CASE WHEN ctrl_count = 0 THEN p.name ELSE null END) AS ungoverned_names"
        )
        rec = await result.single()
        total = rec["total"] if rec else 0
        governed = rec["governed"] if rec else 0
        ungoverned_names = [n for n in (rec["ungoverned_names"] if rec else []) if n is not None]
        insights["governance_coverage"] = {
            "total_projects": total,
            "governed_count": governed,
            "coverage_pct": round(governed / total * 100, 1) if total else 0,
            "ungoverned_projects": ungoverned_names,
        }

        # 2. Compliance Chain — projects fully linked to a ControlFramework
        result = await session.run(
            "MATCH (p:AIProject) "
            "OPTIONAL MATCH (p)-[:GOVERNED_BY]->(c:Control)-[:PART_OF]->(f:ControlFramework) "
            "WITH p, count(f) AS framework_count "
            "RETURN count(p) AS total, "
            "       sum(CASE WHEN framework_count > 0 THEN 1 ELSE 0 END) AS fully_linked"
        )
        rec = await result.single()
        total = rec["total"] if rec else 0
        fully_linked = rec["fully_linked"] if rec else 0
        insights["compliance_chain"] = {
            "total_projects": total,
            "fully_linked": fully_linked,
            "completeness_pct": round(fully_linked / total * 100, 1) if total else 0,
        }

        # 3. Department Risk Concentration
        result = await session.run(
            "MATCH (p:AIProject)-[:BELONGS_TO]->(d:Department) "
            "WITH d.name AS department, p.risk_level AS risk, count(p) AS cnt "
            "ORDER BY department, risk "
            "WITH department, collect({risk_level: risk, count: cnt}) AS breakdown, "
            "     sum(cnt) AS total, "
            "     sum(CASE WHEN risk = 'high' THEN cnt ELSE 0 END) AS high_risk "
            "RETURN department, total, high_risk, breakdown "
            "ORDER BY high_risk DESC"
        )
        dept_risk = []
        async for record in result:
            dept_risk.append({
                "department": record["department"],
                "total_projects": record["total"],
                "high_risk_count": record["high_risk"],
                "breakdown": [dict(b) for b in record["breakdown"]],
            })
        insights["department_risk"] = dept_risk

        # 4. Tool Sprawl — tools shared across workflows and departments
        result = await session.run(
            "MATCH (w:Workflow)-[:USES_TOOL]->(t:Tool) "
            "OPTIONAL MATCH (w)<-[:HAS_WORKFLOW]-(d:Department) "
            "WITH t.name AS tool, "
            "     count(DISTINCT w) AS workflow_count, "
            "     count(DISTINCT d) AS department_count, "
            "     collect(DISTINCT d.name) AS departments "
            "RETURN tool, workflow_count, department_count, departments "
            "ORDER BY department_count DESC, workflow_count DESC"
        )
        tool_sprawl = []
        async for record in result:
            tool_sprawl.append({
                "tool": record["tool"],
                "workflow_count": record["workflow_count"],
                "department_count": record["department_count"],
                "departments": [d for d in record["departments"] if d is not None],
            })
        insights["tool_sprawl"] = tool_sprawl

        # 5. Lifecycle Pipeline — projects grouped by department × status
        result = await session.run(
            "MATCH (p:AIProject)-[:BELONGS_TO]->(d:Department) "
            "WITH d.name AS department, p.status AS status, count(p) AS cnt "
            "ORDER BY department, status "
            "WITH department, collect({status: status, count: cnt}) AS stages "
            "RETURN department, stages "
            "ORDER BY department"
        )
        pipeline = []
        async for record in result:
            pipeline.append({
                "department": record["department"],
                "stages": [dict(s) for s in record["stages"]],
            })
        insights["lifecycle_pipeline"] = pipeline

    return insights


async def get_graph_stats() -> dict:
    """Return node and relationship counts by type."""
    driver = get_driver()
    stats: dict = {"nodes": {}, "relationships": {}, "total_nodes": 0, "total_relationships": 0}

    async with driver.session() as session:
        # Node counts by label
        result = await session.run(
            "MATCH (n) "
            "WITH labels(n)[0] AS label, count(*) AS cnt "
            "RETURN label, cnt ORDER BY label"
        )
        async for record in result:
            stats["nodes"][record["label"]] = record["cnt"]
            stats["total_nodes"] += record["cnt"]

        # Relationship counts by type
        result = await session.run(
            "MATCH ()-[r]->() "
            "WITH type(r) AS rtype, count(*) AS cnt "
            "RETURN rtype, cnt ORDER BY rtype"
        )
        async for record in result:
            stats["relationships"][record["rtype"]] = record["cnt"]
            stats["total_relationships"] += record["cnt"]

    return stats
