from typing import Any, Dict, List, Optional
from bson import ObjectId


def serialize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Convert MongoDB BSON document into JSON-serializable dictionary.
    
    Ensures 'id' is set to either the existing 'id' or string of '_id'.
    """
    if doc is None:
        return None

    result = dict(doc)
    if "_id" in result:
        obj_id = result.pop("_id")
        if "id" not in result or result["id"] is None:
            result["id"] = str(obj_id)

    # Convert any nested ObjectIds
    for k, v in result.items():
        if isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, dict):
            result[k] = serialize_doc(v)
        elif isinstance(v, list):
            result[k] = [
                serialize_doc(item) if isinstance(item, dict)
                else str(item) if isinstance(item, ObjectId)
                else item
                for item in v
            ]

    return result


def serialize_docs(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Serialize a list of MongoDB documents."""
    return [serialize_doc(d) for d in docs if d is not None]
