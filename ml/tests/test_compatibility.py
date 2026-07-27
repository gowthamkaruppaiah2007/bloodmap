from app.features.compatibility import is_blood_compatible, get_compatibility_score

def test_o_negative_universal_donor():
    assert is_blood_compatible("O-", "O-") is True
    assert is_blood_compatible("O-", "A+") is True
    assert is_blood_compatible("O-", "AB+") is True

def test_ab_positive_universal_recipient():
    assert is_blood_compatible("O-", "AB+") is True
    assert is_blood_compatible("A+", "AB+") is True
    assert is_blood_compatible("B-", "AB+") is True
    assert is_blood_compatible("AB+", "AB+") is True

def test_incompatible_transfusion():
    assert is_blood_compatible("A+", "O-") is False
    assert is_blood_compatible("AB+", "B-") is False

def test_compatibility_scores():
    assert get_compatibility_score("A+", "A+") == 1.0
    assert get_compatibility_score("O-", "A+") == 0.7
    assert get_compatibility_score("A+", "O-") == 0.0
