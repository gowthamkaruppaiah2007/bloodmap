"""
ABO and Rh Blood Compatibility Matrix.
"""

BLOOD_MATRIX = {
    "O-": ["O-"],
    "O+": ["O-", "O+"],
    "A-": ["O-", "A-"],
    "A+": ["O-", "O+", "A-", "A+"],
    "B-": ["O-", "B-"],
    "B+": ["O-", "O+", "B-", "B+"],
    "AB-": ["O-", "A-", "B-", "AB-"],
    "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
}

def is_blood_compatible(donor_group: str, recipient_group: str) -> bool:
    """Returns True if donor blood group can be safely transfused to recipient."""
    allowed = BLOOD_MATRIX.get(recipient_group, [])
    return donor_group in allowed

def get_compatibility_score(donor_group: str, recipient_group: str) -> float:
    """Returns 1.0 for exact match, 0.7 for compatible, 0.0 for incompatible."""
    if donor_group == recipient_group:
        return 1.0
    if is_blood_compatible(donor_group, recipient_group):
        return 0.7
    return 0.0
