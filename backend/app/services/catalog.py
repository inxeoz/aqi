CATALOG = {
 "ward": ["Inspect construction sites and road dust in hotspot wards","Order extra road sweeping and water sprinkling","Issue notice limiting waste burning and idling","Divert heavy traffic from hotspot roads at peak hours","Deploy mobile monitoring near worst station for one week"],
 "housing": ["Shift outdoor staff work to morning low-pollution hours","Wet-mop and keep windows closed in dusty hours","Run purifiers in common halls","Stop waste burning; compost garden waste","Share citizen advisory in society group daily"],
 "school": ["Move PE indoors on poor-air days","Hold morning assembly indoors","Issue mask advisory on bus routes","Run classroom purifiers; seal dusty windows","Send advisory note to parents every morning"],
 "other": ["Avoid outdoor exertion in hotspot hours","Keep windows closed in dusty hours","Wear a mask outdoors near hotspots","Follow citizen advisory updates","Report waste burning to ward helpline"],
}
def for_role(role: str) -> list[str]:
    return CATALOG.get(role, CATALOG["other"])
