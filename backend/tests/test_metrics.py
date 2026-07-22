"""測試 app/metrics.py 裡的公式函式。

這些函式都是「有輸入就有固定輸出」的純函式，不需要連資料庫，
所以測試可以跑得很快，也不用另外準備測試用的資料庫。

每個函式重點測兩件事：
1. 正常情況下，公式算出來的數字對不對
2. 分母是 0（或缺資料）時，是不是回傳 None（代表「無法計算」）
"""

from app.metrics import calc_cpa, calc_cpc, calc_cpm, calc_ctr, calc_cvr, calc_roas


def test_calc_cpa_normal():
    assert calc_cpa(cost=1000, conversions=5) == 200


def test_calc_cpa_zero_conversions_returns_none():
    assert calc_cpa(cost=1000, conversions=0) is None


def test_calc_cpc_normal():
    assert calc_cpc(cost=500, clicks=100) == 5


def test_calc_cpc_zero_clicks_returns_none():
    assert calc_cpc(cost=500, clicks=0) is None


def test_calc_cpm_normal():
    assert calc_cpm(cost=100, impressions=2000) == 50


def test_calc_cpm_zero_impressions_returns_none():
    assert calc_cpm(cost=100, impressions=0) is None


def test_calc_ctr_normal():
    assert calc_ctr(clicks=50, impressions=1000) == 5


def test_calc_ctr_zero_impressions_returns_none():
    assert calc_ctr(clicks=50, impressions=0) is None


def test_calc_cvr_normal():
    assert calc_cvr(conversions=10, clicks=200) == 5


def test_calc_cvr_zero_clicks_returns_none():
    assert calc_cvr(conversions=10, clicks=0) is None


def test_calc_roas_normal():
    assert calc_roas(revenue=3000, cost=1000) == 3


def test_calc_roas_no_revenue_returns_none():
    assert calc_roas(revenue=None, cost=1000) is None


def test_calc_roas_zero_cost_returns_none():
    assert calc_roas(revenue=1000, cost=0) is None


def test_calc_roas_negative_cost_returns_none():
    assert calc_roas(revenue=1000, cost=-50) is None
