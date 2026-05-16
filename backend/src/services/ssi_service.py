# File: src/services/ssi_service.py
import requests
import os
from datetime import datetime
from typing import List, Dict
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv()

class SSIService:
    def __init__(self):
        self.base_url = os.getenv("SSI_FC_URL", "https://fc-data.ssi.com.vn/api/v2")
        self.consumer_id = os.getenv("SSI_CONSUMER_ID")
        self.consumer_secret = os.getenv("SSI_CONSUMER_SECRET")
        self.access_token = None

    def login(self):
        """Đăng nhập lấy Token"""
        url = f"{self.base_url}/Market/AccessToken"
        payload = {
            "consumerID": self.consumer_id,
            "consumerSecret": self.consumer_secret
        }
        try:
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == "Success" or data.get("status") == 200 or data.get("responseCode") == 0:
                    # Token can be under 'data' (as string or dict) or 'accessToken' or 'token' depending on version
                    token_candidate = data.get("data") or data.get("token") or data.get("accessToken")
                    
                    if isinstance(token_candidate, dict):
                        self.access_token = token_candidate.get("accessToken") or token_candidate.get("token")
                    else:
                        self.access_token = token_candidate
                        
                    if self.access_token:
                        return True
                    else:
                        print(f"❌ SSI Login Fail: Parsing token thất bại. Data: {data}")
                        return False
                else:
                    print(f"❌ SSI Login Fail: {data.get('message')}")
                    return False
            else:
                print(f"❌ SSI Login HTTP Error {response.status_code}: {response.text}")
                return False
        except Exception as e:
            print(f"❌ SSI Connect Error: {e}")
            return False

    def _get_headers(self):
        if not self.access_token:
            self.login()
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def get_index_summary(self, index_id: str = "VNINDEX") -> Dict:
        """Lấy dữ liệu tóm tắt của chỉ số (Dùng DailyIndex làm fallback vì IndexSummary v2 thường bị lỗi 404)"""
        from datetime import timedelta
        today = datetime.now()
        # Lấy dải 7 ngày để đảm bảo lấy được phiên gần nhất (kể cả cuối tuần)
        from_date = (today - timedelta(days=7)).strftime("%d/%m/%Y")
        to_date = today.strftime("%d/%m/%Y")
        
        history = self.get_index_history(index_id, from_date, to_date)
        if history:
            # SSI trả về list đã sort theo ngày mới nhất ở đầu
            return history[0]
        return None

    def get_index_history(self, index_id: str, from_date: str, to_date: str) -> List[Dict]:
        """
        Fetches historical data for an index using the DailyIndex endpoint.
        Dates must be in DD/MM/YYYY format.
        """
        url = f"{self.base_url}/Market/DailyIndex"
        params = {
            "lookupRequest.indexId": index_id,
            "lookupRequest.fromDate": from_date,
            "lookupRequest.toDate": to_date,
            "lookupRequest.pageIndex": 1,
            "lookupRequest.pageSize": 100
        }
        try:
            response = requests.get(url, headers=self._get_headers(), params=params, timeout=10)
            if response.status_code == 200:
                resp_json = response.json()
                # SSI v2 usually returns data in 'data' or 'dataList'
                return resp_json.get("data") or resp_json.get("dataList") or []
            return []
        except Exception as e:
            print(f"⚠️ SSI DailyIndex Error ({index_id}): {e}")
            return []

    def get_stock_quote(self, symbol: str) -> Dict:
        """Lấy giá khớp lệnh mới nhất của 1 cổ phiếu (Realtime snapshot)"""
        url = f"{self.base_url}/Market/Securities"
        params = {
            "lookupRequest.symbol": symbol,
            "lookupRequest.pageIndex": 1,
            "lookupRequest.pageSize": 10
        }
        try:
            response = requests.get(url, headers=self._get_headers(), params=params, timeout=5)
            if response.status_code == 200:
                resp_json = response.json()
                data_list = resp_json.get("data") or resp_json.get("dataList") or []
                if data_list:
                    # Tìm đúng mã trong danh sách trả về (SSI có thể trả về các mã liên quan)
                    for item in data_list:
                        if (item.get("Symbol") or item.get("symbol")) == symbol.upper():
                            return item
                    # Nếu không tìm thấy chính xác, trả về cái đầu tiên (fallback cũ)
                    return data_list[0]
            elif response.status_code == 401:
                self.access_token = None
            return None
        except Exception as e:
            print(f"⚠️ SSI StockQuote Error ({symbol}): {e}")
            return None


    def get_daily_stock_price(self, symbol: str) -> Dict:
        """Lấy dữ liệu chốt ngày (EOD) của 1 mã từ phiên giao dịch gần nhất"""
        url = f"{self.base_url}/Market/DailyStockPrice"
        
        from datetime import timedelta
        today = datetime.now()
        
        # Quét dải 10 ngày để bù cho các ngày cuối tuần Lễ/Tết
        from_date_str = (today - timedelta(days=10)).strftime("%d/%m/%Y")
        to_date_str = today.strftime("%d/%m/%Y")
        
        params = {
            "lookupRequest.symbol": symbol,
            "lookupRequest.fromDate": from_date_str,
            "lookupRequest.toDate": to_date_str,
            "lookupRequest.pageIndex": 1,
            "lookupRequest.pageSize": 10
        }
        
        try:
            response = requests.get(url, headers=self._get_headers(), params=params, timeout=5)
            if response.status_code == 200:
                resp_json = response.json()
                data_list = resp_json.get("data") or resp_json.get("dataList") or []
                if data_list:
                    # Sort by date descending to get the latest session first.
                    # Date format from SSI is usually DD/MM/YYYY
                    try:
                       data_list.sort(key=lambda x: datetime.strptime(x.get("TradingDate") or x.get("tradingdate"), "%d/%m/%Y"), reverse=True)
                    except:
                       pass
                    return data_list[0]
            elif response.status_code == 429:
                print(f"⚠️ SSI Rate Limit (429) khi tải {symbol}. Thử lại sau...")
            elif response.status_code == 401:
                print(f"⚠️ SSI Token hết hạn (401). Đang đăng nhập lại...")
                self.access_token = None # Để lần sau tự login lại
            else:
                pass # Các lỗi 404, 500 khác không cần in log quá nhiều
            return None
        except Exception as e:
            # print(f"⚠️ SSI Request Error cho {symbol}: {e}")
            return None

    def get_batch_foreign_data(self, symbols: List[str], progress_callback=None) -> Dict[str, dict]:
        """
        Lấy dữ liệu khối ngoại cho danh sách mã.
        Giá trị trả về ở đơn vị VND gốc (chưa chia).
        Gọi tuần tự để tránh rate-limit của SSI API.
        """
        import time
        results = {}
        zero_activity = 0
        api_errors = 0
        missing_data = 0
        
        for i, sym in enumerate(symbols):
            data = self.get_daily_stock_price(sym)
            if data:
                try:
                    buy = float(data.get("ForeignBuyValTotal") or data.get("foreignbuyvaltotal") or 0)
                    sell = float(data.get("ForeignSellValTotal") or data.get("foreignsellvaltotal") or 0)
                    raw_date = data.get("TradingDate") or data.get("tradingdate")
                    
                    # Normalize DD/MM/YYYY to YYYY-MM-DD
                    iso_date = None
                    if raw_date:
                        try:
                            d, m, y = raw_date.split('/')
                            iso_date = f"{y}-{m}-{d}"
                        except Exception:
                            pass

                    if buy > 0 or sell > 0:
                        results[sym] = {
                            "f_buy_val": buy,
                            "f_sell_val": sell,
                            "trading_date": iso_date
                        }
                    else:
                        zero_activity += 1
                except Exception:
                    api_errors += 1
            else:
                missing_data += 1
            
            if progress_callback:
                progress_callback(i + 1, len(symbols))

            if (i + 1) % 50 == 0:
                print(f"   ... SSI Foreign Data: Đã tải {i+1}/{len(symbols)} mã (Thành công: {len(results)}, Zero: {zero_activity}, Lỗi: {api_errors + missing_data})...")
            
            # SSI limit is 1 req / 1 sec strictly
            time.sleep(1.05)

        print(f"DONE: Da tai xong Khoi ngoai: {len(results)} ma co GD, {zero_activity} ma khong GD ngoai, {api_errors + missing_data} ma loi/khong du lieu.")
        return results

    def get_securities_details(self, symbols: List[str]) -> Dict[str, int]:
        """
        Lấy ListedShare (số cổ phiếu niêm yết) cho danh sách mã từ SecuritiesDetails API.
        Trả về: {symbol: listed_shares}
        """
        import time
        results = {}
        
        for i, sym in enumerate(symbols):
            url = f"{self.base_url}/Market/SecuritiesDetails"
            params = {
                "lookupRequest.symbol": sym,
                "lookupRequest.pageIndex": 1,
                "lookupRequest.pageSize": 10
            }
            try:
                response = requests.get(url, headers=self._get_headers(), params=params, timeout=5)
                if response.status_code == 200:
                    resp_json = response.json()
                    data_list = resp_json.get("data") or resp_json.get("dataList") or []
                    if data_list:
                        record = data_list[0]
                        repeated = record.get("RepeatedInfo") or record.get("repeatedinfoList") or []
                        if repeated:
                            listed = repeated[0].get("ListedShare") or repeated[0].get("listedshare") or "0"
                            shares = int(float(listed))
                            if shares > 0:
                                results[sym] = shares

            except requests.exceptions.HTTPError as he:
                if response.status_code == 429:
                    print(f"Rate limited on {sym}, retrying after sleep...")
                    time.sleep(2)
            except Exception:
                pass
            
            if (i + 1) % 50 == 0:
                print(f"   ... SSI Securities Details: Đã tải {i+1}/{len(symbols)} mã...")

            # SSI limit is 1 req / 1 sec strictly
            time.sleep(1.05)
        
        return results