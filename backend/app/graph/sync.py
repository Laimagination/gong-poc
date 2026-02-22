"""Full and incremental graph sync: SQLite/JSON → Neo4j."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlalchemy import select

from ..database import async_session
from ..models import AIProject, AIMSEvent
from ..poc2_discovery.scoring import score_workflow
from .connection import get_driver

logger = logging.getLogger(__name__)

DATA_DIR_POC2 = Path(__file__).resolve().parent.parent / "poc2_discovery" / "data"
DATA_DIR_POC3 = Path(__file__).resolve().parent.parent / "poc3_aims" / "data"

PRINCIPLES = [
    {"id": "self_service", "name": "Self-Service Enablement"},
    {"id": "deal_standardization", "name": "Deal Standardization"},
    {"id": "unified_data", "name": "Unified Data Platform"},
]

FRAMEWORK = {"id": "iso-42001", "name": "ISO/IEC 42001:2023", "scope": "AI Management System"}


def _load_json(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


async def full_sync() -> None:
    """Wipe and rebuild the entire graph from SQLite + JSON sources."""
    driver = get_driver()

    departments = _load_json(DATA_DIR_POC2 / "departments.json")
    workflows = _load_json(DATA_DIR_POC2 / "workflows.json")
    controls = _load_json(DATA_DIR_POC3 / "controls.json")

    # Score all workflows
    scored = [score_workflow(wf) for wf in workflows]

    # Deduplicate tools from departments + workflows
    tool_names: set[str] = set()
    for d in departments:
        tool_names.update(d.get("key_tools", []))
    for wf in workflows:
        tool_names.update(wf.get("current_tools", []))

    # Load SQLAlchemy data
    async with async_session() as db:
        projects = (await db.execute(select(AIProject))).scalars().all()
        events = (
            await db.execute(
                select(AIMSEvent).order_by(AIMSEvent.timestamp.desc()).limit(200)
            )
        ).scalars().all()

    # Build lookup maps
    dept_map = {d["id"]: d for d in departments}
    wf_map = {wf["id"]: wf for wf in workflows}
    score_map = {s.id: s for s in scored}

    async with driver.session() as session:
        # 1. Clear graph
        await session.run("MATCH (n) DETACH DELETE n")

        # 2. Create uniqueness constraints
        for label, prop in [
            ("Department", "graph_id"),
            ("Tool", "graph_id"),
            ("Workflow", "graph_id"),
            ("WorkflowScore", "graph_id"),
            ("AIProject", "graph_id"),
            ("Control", "graph_id"),
            ("Principle", "graph_id"),
            ("ControlFramework", "graph_id"),
            ("AIMSEvent", "graph_id"),
        ]:
            await session.run(
                f"CREATE CONSTRAINT IF NOT EXISTS FOR (n:{label}) REQUIRE n.graph_id IS UNIQUE"
            )

        # 3. Create nodes

        # Departments
        dept_batch = [
            {
                "graph_id": f"Department-{d['id']}",
                "dept_id": d["id"],
                "name": d["name"],
                "headcount": d["headcount"],
                "open_roles": d["open_roles"],
            }
            for d in departments
        ]
        await session.run(
            "UNWIND $batch AS row "
            "CREATE (n:Department {graph_id: row.graph_id, dept_id: row.dept_id, "
            "name: row.name, headcount: row.headcount, open_roles: row.open_roles})",
            batch=dept_batch,
        )

        # Tools
        tool_batch = [
            {"graph_id": f"Tool-{t}", "name": t}
            for t in sorted(tool_names)
        ]
        await session.run(
            "UNWIND $batch AS row "
            "CREATE (n:Tool {graph_id: row.graph_id, name: row.name})",
            batch=tool_batch,
        )

        # Workflows
        wf_batch = [
            {
                "graph_id": f"Workflow-{wf['id']}",
                "wf_id": wf["id"],
                "name": wf["name"],
                "department": wf["department"],
                "description": wf["description"],
                "frequency": wf["frequency"],
                "estimated_build_hours": wf["estimated_build_hours"],
                "annual_cost_savings_usd": wf["annual_cost_savings_usd"],
            }
            for wf in workflows
        ]
        await session.run(
            "UNWIND $batch AS row "
            "CREATE (n:Workflow {graph_id: row.graph_id, wf_id: row.wf_id, "
            "name: row.name, department: row.department, description: row.description, "
            "frequency: row.frequency, estimated_build_hours: row.estimated_build_hours, "
            "annual_cost_savings_usd: row.annual_cost_savings_usd})",
            batch=wf_batch,
        )

        # WorkflowScores
        score_batch = [
            {
                "graph_id": f"WorkflowScore-{s.id}",
                "wf_id": s.id,
                "composite": s.scores.composite,
                "revenue_impact": s.scores.revenue_impact,
                "headcount_pressure": s.scores.headcount_pressure,
                "implementation_complexity": s.scores.implementation_complexity,
                "self_service_potential": s.scores.self_service_potential,
                "rank": s.rank,
            }
            for s in scored
        ]
        await session.run(
            "UNWIND $batch AS row "
            "CREATE (n:WorkflowScore {graph_id: row.graph_id, wf_id: row.wf_id, "
            "composite: row.composite, revenue_impact: row.revenue_impact, "
            "headcount_pressure: row.headcount_pressure, "
            "implementation_complexity: row.implementation_complexity, "
            "self_service_potential: row.self_service_potential, rank: row.rank})",
            batch=score_batch,
        )

        # AIProjects
        proj_batch = [
            {
                "graph_id": f"AIProject-{p.id}",
                "project_id": p.id,
                "workflow_id": p.workflow_id,
                "name": p.name,
                "department": p.department,
                "status": p.status,
                "risk_level": p.risk_level,
                "risk_score": p.risk_score,
                "benefit_score": p.benefit_score,
                "owner": p.owner,
            }
            for p in projects
        ]
        await session.run(
            "UNWIND $batch AS row "
            "CREATE (n:AIProject {graph_id: row.graph_id, project_id: row.project_id, "
            "workflow_id: row.workflow_id, name: row.name, department: row.department, "
            "status: row.status, risk_level: row.risk_level, risk_score: row.risk_score, "
            "benefit_score: row.benefit_score, owner: row.owner})",
            batch=proj_batch,
        )

        # Controls
        ctrl_batch = [
            {
                "graph_id": f"Control-{c['id']}",
                "control_id": c["id"],
                "name": c["name"],
                "category": c["category"],
                "description": c["description"],
            }
            for c in controls
        ]
        await session.run(
            "UNWIND $batch AS row "
            "CREATE (n:Control {graph_id: row.graph_id, control_id: row.control_id, "
            "name: row.name, category: row.category, description: row.description})",
            batch=ctrl_batch,
        )

        # Principles
        princ_batch = [
            {"graph_id": f"Principle-{p['id']}", "principle_id": p["id"], "name": p["name"]}
            for p in PRINCIPLES
        ]
        await session.run(
            "UNWIND $batch AS row "
            "CREATE (n:Principle {graph_id: row.graph_id, principle_id: row.principle_id, name: row.name})",
            batch=princ_batch,
        )

        # ControlFramework
        await session.run(
            "CREATE (n:ControlFramework {graph_id: $gid, name: $name, scope: $scope})",
            gid=f"ControlFramework-{FRAMEWORK['id']}",
            name=FRAMEWORK["name"],
            scope=FRAMEWORK["scope"],
        )

        # AIMSEvents
        event_batch = [
            {
                "graph_id": f"AIMSEvent-{e.id}",
                "event_id": e.id,
                "project_id": e.project_id,
                "event_type": e.event_type,
                "from_status": e.from_status,
                "to_status": e.to_status,
                "actor": e.actor,
                "detail": e.detail,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            }
            for e in events
        ]
        if event_batch:
            await session.run(
                "UNWIND $batch AS row "
                "CREATE (n:AIMSEvent {graph_id: row.graph_id, event_id: row.event_id, "
                "project_id: row.project_id, event_type: row.event_type, "
                "from_status: row.from_status, to_status: row.to_status, "
                "actor: row.actor, detail: row.detail, timestamp: row.timestamp})",
                batch=event_batch,
            )

        # 4. Create relationships

        # Department -[HAS_WORKFLOW]-> Workflow
        hw_batch = [
            {"dept_gid": f"Department-{wf['department']}", "wf_gid": f"Workflow-{wf['id']}"}
            for wf in workflows
        ]
        await session.run(
            "UNWIND $batch AS row "
            "MATCH (d:Department {graph_id: row.dept_gid}), (w:Workflow {graph_id: row.wf_gid}) "
            "CREATE (d)-[:HAS_WORKFLOW]->(w)",
            batch=hw_batch,
        )

        # Department -[USES_TOOL]-> Tool
        dept_tool_batch = [
            {"dept_gid": f"Department-{d['id']}", "tool_gid": f"Tool-{t}"}
            for d in departments
            for t in d.get("key_tools", [])
        ]
        await session.run(
            "UNWIND $batch AS row "
            "MATCH (d:Department {graph_id: row.dept_gid}), (t:Tool {graph_id: row.tool_gid}) "
            "CREATE (d)-[:USES_TOOL]->(t)",
            batch=dept_tool_batch,
        )

        # Workflow -[USES_TOOL]-> Tool
        wf_tool_batch = [
            {"wf_gid": f"Workflow-{wf['id']}", "tool_gid": f"Tool-{t}"}
            for wf in workflows
            for t in wf.get("current_tools", [])
        ]
        await session.run(
            "UNWIND $batch AS row "
            "MATCH (w:Workflow {graph_id: row.wf_gid}), (t:Tool {graph_id: row.tool_gid}) "
            "CREATE (w)-[:USES_TOOL]->(t)",
            batch=wf_tool_batch,
        )

        # Workflow -[FOLLOWS_PRINCIPLE]-> Principle
        wf_princ_batch = [
            {"wf_gid": f"Workflow-{wf['id']}", "princ_gid": f"Principle-{p}"}
            for wf in workflows
            for p in wf.get("jim_principles", [])
        ]
        await session.run(
            "UNWIND $batch AS row "
            "MATCH (w:Workflow {graph_id: row.wf_gid}), (p:Principle {graph_id: row.princ_gid}) "
            "CREATE (w)-[:FOLLOWS_PRINCIPLE]->(p)",
            batch=wf_princ_batch,
        )

        # Workflow -[HAS_SCORE]-> WorkflowScore
        ws_batch = [
            {"wf_gid": f"Workflow-{s.id}", "score_gid": f"WorkflowScore-{s.id}"}
            for s in scored
        ]
        await session.run(
            "UNWIND $batch AS row "
            "MATCH (w:Workflow {graph_id: row.wf_gid}), (s:WorkflowScore {graph_id: row.score_gid}) "
            "CREATE (w)-[:HAS_SCORE]->(s)",
            batch=ws_batch,
        )

        # Workflow -[BECAME_PROJECT]-> AIProject
        bp_batch = [
            {"wf_gid": f"Workflow-{p.workflow_id}", "proj_gid": f"AIProject-{p.id}"}
            for p in projects
            if p.workflow_id in wf_map
        ]
        await session.run(
            "UNWIND $batch AS row "
            "MATCH (w:Workflow {graph_id: row.wf_gid}), (p:AIProject {graph_id: row.proj_gid}) "
            "CREATE (w)-[:BECAME_PROJECT]->(p)",
            batch=bp_batch,
        )

        # AIProject -[BELONGS_TO]-> Department
        bt_batch = [
            {"proj_gid": f"AIProject-{p.id}", "dept_gid": f"Department-{p.department}"}
            for p in projects
            if p.department in dept_map
        ]
        await session.run(
            "UNWIND $batch AS row "
            "MATCH (p:AIProject {graph_id: row.proj_gid}), (d:Department {graph_id: row.dept_gid}) "
            "CREATE (p)-[:BELONGS_TO]->(d)",
            batch=bt_batch,
        )

        # AIProject -[GOVERNED_BY]-> Control
        ctrl_set = {c["id"] for c in controls}
        gov_batch = [
            {"proj_gid": f"AIProject-{p.id}", "ctrl_gid": f"Control-{cid}"}
            for p in projects
            for cid in (p.controls or [])
            if cid in ctrl_set
        ]
        await session.run(
            "UNWIND $batch AS row "
            "MATCH (p:AIProject {graph_id: row.proj_gid}), (c:Control {graph_id: row.ctrl_gid}) "
            "CREATE (p)-[:GOVERNED_BY]->(c)",
            batch=gov_batch,
        )

        # Control -[PART_OF]-> ControlFramework
        # Impact and operational controls are internal-only, not yet mapped
        # to the ISO 42001 framework.  The base risk control (A.6.2.2) and
        # ethical/legal controls ARE mapped, so the compliance chain gap
        # only appears for projects that have unmapped controls mixed in.
        _INTERNAL_ONLY_CONTROLS = {
            "A.6.2.4",                                      # risk treatment
            "A.7.3", "A.7.4",                              # impact
            "A.10.2", "A.10.3", "A.10.4", "A.10.5", "A.10.6",  # operations
        }
        fw_gid = f"ControlFramework-{FRAMEWORK['id']}"
        po_batch = [
            {"ctrl_gid": f"Control-{c['id']}", "fw_gid": fw_gid}
            for c in controls
            if c["id"] not in _INTERNAL_ONLY_CONTROLS
        ]
        await session.run(
            "UNWIND $batch AS row "
            "MATCH (c:Control {graph_id: row.ctrl_gid}), (f:ControlFramework {graph_id: row.fw_gid}) "
            "CREATE (c)-[:PART_OF]->(f)",
            batch=po_batch,
        )

        # AIProject -[HAS_EVENT]-> AIMSEvent
        he_batch = [
            {"proj_gid": f"AIProject-{e.project_id}", "ev_gid": f"AIMSEvent-{e.id}"}
            for e in events
        ]
        if he_batch:
            await session.run(
                "UNWIND $batch AS row "
                "MATCH (p:AIProject {graph_id: row.proj_gid}), (e:AIMSEvent {graph_id: row.ev_gid}) "
                "CREATE (p)-[:HAS_EVENT]->(e)",
                batch=he_batch,
            )

    logger.info("Neo4j full graph sync complete")


async def sync_project(project_id: int) -> None:
    """Incremental sync: update one AIProject node and its new events."""
    driver = get_driver()

    async with async_session() as db:
        result = await db.execute(
            select(AIProject).where(AIProject.id == project_id)
        )
        project = result.scalar_one_or_none()
        if not project:
            return

        events = (
            await db.execute(
                select(AIMSEvent)
                .where(AIMSEvent.project_id == project_id)
                .order_by(AIMSEvent.timestamp.desc())
                .limit(50)
            )
        ).scalars().all()

    proj_gid = f"AIProject-{project_id}"

    async with driver.session() as session:
        # Update project node properties
        await session.run(
            "MATCH (p:AIProject {graph_id: $gid}) "
            "SET p.status = $status, p.risk_level = $risk_level, "
            "p.risk_score = $risk_score, p.benefit_score = $benefit_score, "
            "p.owner = $owner",
            gid=proj_gid,
            status=project.status,
            risk_level=project.risk_level,
            risk_score=project.risk_score,
            benefit_score=project.benefit_score,
            owner=project.owner,
        )

        # Merge new event nodes
        for e in events:
            ev_gid = f"AIMSEvent-{e.id}"
            await session.run(
                "MERGE (ev:AIMSEvent {graph_id: $gid}) "
                "ON CREATE SET ev.event_id = $eid, ev.project_id = $pid, "
                "ev.event_type = $etype, ev.from_status = $fst, ev.to_status = $tst, "
                "ev.actor = $actor, ev.detail = $detail, ev.timestamp = $ts "
                "WITH ev "
                "MATCH (p:AIProject {graph_id: $proj_gid}) "
                "MERGE (p)-[:HAS_EVENT]->(ev)",
                gid=ev_gid,
                eid=e.id,
                pid=e.project_id,
                etype=e.event_type,
                fst=e.from_status,
                tst=e.to_status,
                actor=e.actor,
                detail=e.detail,
                ts=e.timestamp.isoformat() if e.timestamp else None,
                proj_gid=proj_gid,
            )

    logger.info(f"Neo4j incremental sync for project {project_id} complete")
