"""Neo4j async driver singleton and health check."""

from neo4j import AsyncGraphDatabase

from ..config import get_settings

_driver = None


def get_driver():
    """Lazy-init and return the async Neo4j driver."""
    global _driver
    if _driver is None:
        s = get_settings()
        _driver = AsyncGraphDatabase.driver(
            s.neo4j_uri, auth=(s.neo4j_user, s.neo4j_password)
        )
    return _driver


async def close_driver():
    """Shutdown cleanup — call during app lifespan teardown."""
    global _driver
    if _driver is not None:
        await _driver.close()
        _driver = None


async def check_health() -> bool:
    """Return True if Neo4j is reachable."""
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run("RETURN 1 AS ok")
        record = await result.single()
        return record is not None and record["ok"] == 1
