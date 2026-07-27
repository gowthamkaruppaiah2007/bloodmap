from app.models.forecaster import DemandForecaster

def test_demand_forecaster():
    forecaster = DemandForecaster()
    res = forecaster.predict(region="Global", blood_group="O+", horizon_days=7)

    assert res.region == "Global"
    assert res.blood_group == "O+"
    assert res.horizon_days == 7
    assert len(res.forecast) == 7
    assert res.total_projected > 0
    assert len(res.peak_day) > 0
