from app.models.matcher import DonorMatcher
from app.schemas import DonorCandidate

def test_donor_matcher_ranking():
    matcher = DonorMatcher()
    
    donors = [
        DonorCandidate(id="d1", blood_group="A+", latitude=12.97, longitude=77.59, is_available=True),
        DonorCandidate(id="d2", blood_group="O-", latitude=12.98, longitude=77.60, is_available=True),
        DonorCandidate(id="d3", blood_group="B-", latitude=12.97, longitude=77.59, is_available=True),
    ]

    # Recipient: A+
    ranked = matcher.rank_donors("req_1", "A+", 12.97, 77.59, donors)
    
    assert len(ranked) == 2  # A+ and O- compatible; B- excluded
    assert ranked[0].id == "d1"  # Exact match top rank
    assert ranked[0].score >= ranked[1].score
