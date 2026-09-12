from dataclasses import dataclass
from enum import StrEnum


class PermitType(StrEnum):
    # DBI building permits (types 1-8 in DataSF i98e-djp9)
    NEW_CONSTRUCTION = "new_construction"
    NEW_CONSTRUCTION_WOOD_FRAME = "new_construction_wood_frame"
    ADDITIONS_ALTERATIONS_REPAIRS = "additions_alterations_repairs"
    SIGN_ERECT = "sign_erect"
    GRADE_QUARRY_FILL_EXCAVATE = "grade_quarry_fill_excavate"
    DEMOLITIONS = "demolitions"
    WALL_OR_PAINTED_SIGN = "wall_or_painted_sign"
    OTC_ALTERATIONS = "otc_alterations"

    # Trade permits
    ELECTRICAL = "electrical"
    PLUMBING = "plumbing"
    MECHANICAL = "mechanical"

    # DPW public works permits (from DataSF 6wa6-8527)
    STREET_IMPROVEMENT = "street_improvement"
    SIDEWALK_REPAIR = "sidewalk_repair"
    DRIVEWAY_CURB_CUT = "driveway_curb_cut"
    GENERAL_EXCAVATION = "general_excavation"
    UTILITY_EXCAVATION = "utility_excavation"
    SIDE_SEWER = "side_sewer"
    TEMPORARY_OCCUPANCY = "temporary_occupancy"
    TABLES_AND_CHAIRS = "tables_and_chairs"
    DISPLAY_MERCHANDISE = "display_merchandise"
    DEBRIS_BOX = "debris_box"
    MOBILE_STORAGE_CONTAINER = "mobile_storage_container"
    NIGHT_NOISE = "night_noise"
    MINOR_SIDEWALK_ENCROACHMENT = "minor_sidewalk_encroachment"
    MAJOR_ENCROACHMENT = "major_encroachment"

    # Street events
    SPECIAL_EVENT_STREET_CLOSURE = "special_event_street_closure"
    BLOCK_PARTY = "block_party"
    ENTERTAINMENT = "entertainment"
    FIRE_SPECIAL_EVENT = "fire_special_event"
    FOOD_VENDOR_SPONSOR = "food_vendor_sponsor"
    FOOD_VENDOR_CONCESSIONAIRE = "food_vendor_concessionaire"


@dataclass
class PermitInfo:
    name: str
    description: str
    url: str


PERMITS: dict[PermitType, PermitInfo] = {
    # DBI building permits
    PermitType.NEW_CONSTRUCTION: PermitInfo(
        name="New Construction Permit",
        description=(
            "Required for new building construction (non-wood frame)."
            " Includes concrete, steel, and mixed-material structures."
        ),
        url="https://sf.gov/topics/building-permits",
    ),
    PermitType.NEW_CONSTRUCTION_WOOD_FRAME: PermitInfo(
        name="New Construction Permit (Wood Frame)",
        description="Required for new wood-frame building construction.",
        url="https://sf.gov/topics/building-permits",
    ),
    PermitType.ADDITIONS_ALTERATIONS_REPAIRS: PermitInfo(
        name="Additions, Alterations, or Repairs Permit",
        description=(
            "Required for structural additions, major alterations, or significant"
            " repairs to existing buildings. Includes adding rooms, decks, or"
            " modifying load-bearing elements."
        ),
        url="https://sf.gov/topics/building-permits",
    ),
    PermitType.SIGN_ERECT: PermitInfo(
        name="Sign Erection Permit",
        description=(
            "Required for installing new freestanding or projecting signs on buildings or property."
        ),
        url="https://sf.gov/topics/building-permits",
    ),
    PermitType.GRADE_QUARRY_FILL_EXCAVATE: PermitInfo(
        name="Grading / Excavation Permit",
        description=("Required for grading, quarrying, filling, or excavation work on a property."),
        url="https://sf.gov/topics/building-permits",
    ),
    PermitType.DEMOLITIONS: PermitInfo(
        name="Demolition Permit",
        description="Required for partial or full demolition of a structure.",
        url="https://sf.gov/topics/building-permits",
    ),
    PermitType.WALL_OR_PAINTED_SIGN: PermitInfo(
        name="Wall or Painted Sign Permit",
        description=(
            "Required for signs painted directly on or mounted flat against a building wall."
        ),
        url="https://sf.gov/topics/building-permits",
    ),
    PermitType.OTC_ALTERATIONS: PermitInfo(
        name="Over-the-Counter Alterations Permit",
        description=(
            "For minor interior alterations that don't change the building's"
            " structure, footprint, or use. Examples: replacing kitchen cabinets,"
            " non-structural interior walls, or cosmetic renovations."
        ),
        url="https://sf.gov/topics/building-permits",
    ),
    # Trade permits
    PermitType.ELECTRICAL: PermitInfo(
        name="Electrical Permit",
        description=(
            "Required for electrical wiring, panel upgrades, new circuits,"
            " or major electrical modifications."
        ),
        url="https://sf.gov/topics/building-permits",
    ),
    PermitType.PLUMBING: PermitInfo(
        name="Plumbing Permit",
        description=(
            "Required for new plumbing installations, re-piping,"
            " water heater replacement, or gas line work."
        ),
        url="https://sf.gov/topics/building-permits",
    ),
    PermitType.MECHANICAL: PermitInfo(
        name="Mechanical Permit",
        description=(
            "Required for HVAC installation or replacement, ductwork,"
            " and mechanical ventilation systems."
        ),
        url="https://sf.gov/topics/building-permits",
    ),
    # DPW public works permits
    PermitType.STREET_IMPROVEMENT: PermitInfo(
        name="Street Improvement Permit",
        description=(
            "Required for modifications to public streets including paving,"
            " curb changes, and streetscape improvements."
        ),
        url="https://sf.gov/departments/public-works",
    ),
    PermitType.SIDEWALK_REPAIR: PermitInfo(
        name="Sidewalk Repair Permit",
        description=(
            "Required for repairing or replacing public sidewalks adjacent to your property."
        ),
        url="https://sf.gov/departments/public-works",
    ),
    PermitType.DRIVEWAY_CURB_CUT: PermitInfo(
        name="Driveway / Curb Cut Permit",
        description=("Required for new driveways or modifications to existing curb cuts."),
        url="https://sf.gov/departments/public-works",
    ),
    PermitType.GENERAL_EXCAVATION: PermitInfo(
        name="General Excavation Permit",
        description="Required for excavation work in the public right-of-way.",
        url="https://sf.gov/departments/public-works",
    ),
    PermitType.UTILITY_EXCAVATION: PermitInfo(
        name="Utility Excavation Permit",
        description=("Required for utility companies to excavate in the public right-of-way."),
        url="https://sf.gov/departments/public-works",
    ),
    PermitType.SIDE_SEWER: PermitInfo(
        name="Side Sewer Permit",
        description=(
            "Required for installing, repairing, or replacing a side sewer"
            " connection from a building to the city main."
        ),
        url="https://sf.gov/departments/public-works",
    ),
    PermitType.TEMPORARY_OCCUPANCY: PermitInfo(
        name="Temporary Occupancy Permit",
        description=(
            "Required for temporary structures or use of the public"
            " right-of-way (e.g., scaffolding, construction staging)."
        ),
        url="https://sfpublicworks.org/services/permits/temporary-occupancy",
    ),
    PermitType.TABLES_AND_CHAIRS: PermitInfo(
        name="Tables and Chairs Permit",
        description=(
            "Required for placing tables and chairs on the public sidewalk for outdoor dining."
        ),
        url="https://sf.gov/departments/public-works",
    ),
    PermitType.DISPLAY_MERCHANDISE: PermitInfo(
        name="Display Merchandise Permit",
        description=(
            "Required for displaying merchandise on the public sidewalk outside a retail business."
        ),
        url="https://sf.gov/departments/public-works",
    ),
    PermitType.DEBRIS_BOX: PermitInfo(
        name="Debris Box Permit",
        description=("Required for placing a dumpster or debris box in the public right-of-way."),
        url="https://sf.gov/departments/public-works",
    ),
    PermitType.MOBILE_STORAGE_CONTAINER: PermitInfo(
        name="Mobile Storage Container Permit",
        description=(
            "Required for placing a portable storage container"
            " (e.g., PODS) on the public right-of-way."
        ),
        url="https://sf.gov/departments/public-works",
    ),
    PermitType.NIGHT_NOISE: PermitInfo(
        name="Night Noise Authorization",
        description=(
            "Required for construction or other noise-generating activities during nighttime hours."
        ),
        url="https://sfpublicworks.org/services/permits/temporary-occupancy",
    ),
    PermitType.MINOR_SIDEWALK_ENCROACHMENT: PermitInfo(
        name="Minor Sidewalk Encroachment Permit",
        description=(
            "Required for minor encroachments into the public sidewalk"
            " such as steps, planter boxes, or basement access doors."
        ),
        url="https://sf.gov/departments/public-works",
    ),
    PermitType.MAJOR_ENCROACHMENT: PermitInfo(
        name="Major Encroachment Permit",
        description=(
            "Required for significant encroachments into the public"
            " right-of-way such as bay windows, balconies,"
            " or underground structures."
        ),
        url="https://sf.gov/departments/public-works",
    ),
    # Street events
    PermitType.SPECIAL_EVENT_STREET_CLOSURE: PermitInfo(
        name="Special Event Street Closure Permit",
        description=(
            "Required for closing a street for a special event such as"
            " a street fair or festival. Issued by SFMTA through ISCOTT."
        ),
        url="https://sf.gov/get-a-permit-to-close-a-street-for-a-special-event",
    ),
    PermitType.BLOCK_PARTY: PermitInfo(
        name="Block Party Permit",
        description=(
            "Required for neighborhood block parties that close a residential"
            " street. Simpler process than a full special event closure."
        ),
        url="https://sf.gov/host-a-neighborhood-block-party",
    ),
    PermitType.ENTERTAINMENT: PermitInfo(
        name="Entertainment Permit (Outdoor)",
        description=(
            "Required for amplified sound or entertainment at an outdoor event."
            " Issued by the Entertainment Commission."
        ),
        url="https://sf.gov/get-entertainment-permit-your-outdoor-event",
    ),
    PermitType.FIRE_SPECIAL_EVENT: PermitInfo(
        name="Fire Permit (Special Event)",
        description=(
            "Required when a special event involves cooking,"
            " tents over 400 sq ft, generators, propane, or pyrotechnics."
        ),
        url="https://sf.gov/apply-for-a-fire-permit-special-event",
    ),
    PermitType.FOOD_VENDOR_SPONSOR: PermitInfo(
        name="Food Vendor Sponsor Permit",
        description=(
            "Required for the event organizer sponsoring food vendors"
            " at a temporary community event. Issued by DPH."
        ),
        url="https://sf.gov/organize-food-vendors-for-a-special-event",
    ),
    PermitType.FOOD_VENDOR_CONCESSIONAIRE: PermitInfo(
        name="Food Vendor Concessionaire Permit",
        description=(
            "Required for individual food vendors selling at a temporary"
            " community event. Issued by DPH."
        ),
        url="https://sf.gov/sell-food-or-drinks-temporary-community-event",
    ),
}
