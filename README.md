# 📈 Brokerz Terminal — Institutional Financial Intelligence & Secure Advisory Workspace

**Brokerz Terminal** là một nền tảng hỗ trợ tư vấn đầu tư chuyên nghiệp (Institutional Financial Intelligence & Secure Advisory Workspace) được thiết kế đặc biệt nhằm nâng tầm hoạt động tư vấn, quản lý danh mục mẫu và tương tác giữa các Môi giới chứng khoán chuyên nghiệp (Brokers) và tệp khách hàng VIP (Investors). 

Nền tảng này giải quyết triệt để khoảng trống quản trị tư vấn trong ngành chứng khoán Việt Nam bằng cách thay thế các kênh chat tuyến tính thiếu cấu trúc (như Zalo/Telegram) bằng một hệ thống lưu vết bất biến (**Immutable Footprint Trail**), tích hợp danh mục giả lập thời gian thực (**Mock Portfolio**) và trợ lý trí tuệ nhân tạo thế hệ mới (**Hybrid RAG AI Assistant**).

---

## 🏆 Tính năng Cốt lõi & Trải nghiệm Hình ảnh

Để tích hợp hình ảnh vào tài liệu `README.md` hiển thị trên GitHub/GitLab một cách chuyên nghiệp, toàn bộ tài sản ảnh chụp màn hình (screenshots) đã được chuẩn hóa và lưu trữ trực tiếp bên trong cấu trúc thư mục của repository tại `docs/images/`. Điều này giúp các liên kết ảnh dưới dạng đường dẫn tương đối luôn hiển thị hoàn hảo khi bạn public dự án lên portfolio cá nhân của mình.

### 🔐 1. Hệ thống Phân quyền Bảo mật & Cổng Xác thực SoulKey

Brokerz phân tách hoàn toàn giao thức làm việc giữa Môi giới chuyên nghiệp và Nhà đầu tư VIP. Để bảo vệ các chiến lược đầu tư độc quyền, nhà đầu tư mới được kết nối thông qua cơ chế **SoulKey** duy nhất được cấp bởi Broker của họ.

| 👔 Cổng đăng nhập Broker | 💎 Cổng đăng nhập Investor |
| :---: | :---: |
| ![Broker Login](docs/images/broker-login.png) | ![Investor Login](docs/images/investor-login.png) |

> **Cổng kích hoạt thành viên (SoulKey Tethering Gate)**: Sau khi đăng nhập bằng tài khoản mạng xã hội hoặc email cá nhân, nhà đầu tư phải xác thực qua mã bảo mật `SoulKey` (ví dụ: `BKZ-ALPHA-9999`) để liên kết và mở khóa workspace của Broker.
>
> ![SoulKey Verification Gate](docs/images/investor-verification-to-log-in.png)

---

### 👔 2. Giao diện Môi giới Chuyên nghiệp (Broker Workspace)

Workspace dành riêng cho Broker tập trung hoàn toàn vào việc tối ưu hóa năng suất phân tích thị trường, quản lý chiến lược danh mục và hỗ trợ khách hàng VIP ở quy mô lớn nhờ sự đồng hành của AI.

#### 📈 Trợ lý Nhận định Thị trường AI (Hybrid RAG Market Reporter)
* **Tính năng**: Tự động hóa quá trình tổng hợp số liệu thị trường cuối ngày qua API trực tuyến. Hệ thống cho phép Broker ghi đè (override) nhận định kỹ thuật, điểm số P/E, khối ngoại và yêu cầu AI viết nháp bản tin theo đúng văn phong cá nhân của môi giới đó.
* **Hình ảnh thực tế**:
  
  ![AI Market Reporter](docs/images/broker-1.png)

#### 💼 Quản lý Danh mục Mẫu (Event-Sourced Model Portfolio)
* **Tính năng**: Broker thiết lập các khuyến nghị cổ phiếu trực tiếp, phân phối tỷ trọng danh mục (validate tổng tỷ trọng không vượt quá 100%) và cập nhật trạng thái mua mới/bán hết kèm luận điểm phân tích chi tiết.
* **Hình ảnh thực tế**:
  
  ![Portfolio Workspace](docs/images/broker-2.png)

#### 💬 Trình Quản lý Hỏi đáp Chuyên sâu (Inquiry Hub Thread Manager)
* **Tính năng**: Gom các thắc mắc của khách hàng về từng mã cổ phiếu cụ thể thành các Thread độc lập giống Slack. Broker có sự hỗ trợ của AI để gợi ý soạn thảo nội dung trả lời nhanh dựa trên kho dữ liệu tri thức tích lũy của chính mình.
* **Hình ảnh thực tế**:
  
  ![Inquiry Hub](docs/images/broker-3.png)

#### 🎛️ Bố cục Workspace Cá nhân hóa (Custom Dashboard Grid)
* **Tính năng**: Cho phép Broker tự do thay đổi, sắp xếp bố cục hiển thị số liệu tùy theo trường phái đầu tư cá nhân (Phân tích kỹ thuật ưu tiên chart giá, Phân tích cơ bản ưu tiên báo cáo tài chính).
* **Hình ảnh thực tế**:
  
  ![Custom Dashboard Layout](docs/images/broker-4.png)

---

### 💎 3. Giao diện Nhà đầu tư VIP (Investor Client Portal)

Cổng thông tin dành cho nhà đầu tư VIP mang đến một trải nghiệm minh bạch tuyệt đối, số liệu trực quan sinh động và kết nối tức thì tới chuyên gia tư vấn.

#### 📊 Bảng điều khiển Thị trường & Bản tin Khuyến nghị
* **Tính năng**: Xem nhanh biến động các chỉ số chứng khoán (VN-Index, HNX, Upcom) theo thời gian thực, độ rộng dòng tiền ngành cùng các bản tin Daily Brief vừa được Broker phát hành chính thức.
* **Hình ảnh thực tế**:
  
  ![Investor Overview Dashboard](docs/images/investor-1.png)

#### 💼 Theo dõi Danh mục Mẫu & Sổ Nhật ký Bất biến (Immutable Audit Trail)
* **Tính năng**: Hiệu suất danh mục mẫu được tính toán tự động dựa trên giá thị trường cập nhật từ API. Toàn bộ lịch sử nâng/hạ tỷ trọng hoặc chốt lời/cắt lỗ của Broker được ghi vết bất biến, không thể tẩy xóa hay sửa đổi lịch sử.
* **Hình ảnh thực tế**:
  
  ![Investor Portfolio View](docs/images/investor-2.png)

#### 💬 Chat Box Hỏi đáp Tích hợp Trợ lý AI
* **Tính năng**: Nơi nhà đầu tư trao đổi trực tiếp với Broker của mình về các mã cổ phiếu quan tâm. Hệ thống tự động tổng hợp câu trả lời từ cơ sở dữ liệu tri thức của môi giới để giải đáp tức thì các thông tin cơ bản.
* **Hình ảnh thực tế**:
  
  ![Investor Inquiry Chat](docs/images/investor-3.png)

#### 🔔 Hệ thống Cảnh báo & Thông báo VIP (Alerts & Workspace Info)
* **Tính năng**: Nhận thông báo đẩy ngay lập tức khi Broker công bố danh mục mới hoặc thay đổi các chiến lược khuyến nghị quan trọng.
* **Hình ảnh thực tế**:
  
  ![Investor Notifications & Profile](docs/images/investor-4.png)

---

## 📊 Bối cảnh Thị trường & Giải pháp Khác biệt

### Nghịch lý của ngành Tư vấn Đầu tư truyền thống
Hầu hết các môi giới tại công ty chứng khoán Việt Nam hiện đang sử dụng các công cụ giao tiếp không liền mạch như Zalo cá nhân, nhóm Facebook hay Telegram để chăm sóc khách hàng. Điều này tạo ra 4 "điểm đau" (pain points) cốt lõi:
1. **Dữ liệu phân mảnh, dễ trôi**: Khuyến nghị đầu tư quan trọng dễ bị chìm nghỉm giữa hàng trăm tin nhắn tán gẫu thường ngày.
2. **Thiếu minh bạch (Chỉnh sửa lịch sử)**: Khuyến nghị trên chat dễ bị Broker xóa hoặc chỉnh sửa thông tin khi phán đoán sai lệch, phá vỡ niềm tin của nhà đầu tư VIP.
3. **Giới hạn khả năng mở rộng (Scale)**: Một môi giới chỉ có thể chăm sóc tối đa 100 - 200 khách hàng trên Zalo trước khi bị quá tải câu hỏi lặp lại.
4. **Mất tài sản dữ liệu của công ty**: Mọi tri thức tư vấn và tương tác khách hàng nằm trên server của ứng dụng bên thứ ba (Zalo, Telegram), công ty chứng khoán không thể lưu trữ hay phân tích hành vi người dùng.

### So sánh Giải pháp Brokerz vs. Các Kênh truyền thống

| Tiêu chí đánh giá | Kênh Chat Cá Nhân (Zalo, Viber) | Hội Nhóm Cộng Đồng (Facebook) | Kênh Thông Báo (Telegram Channel) | Nền tảng Brokerz Terminal |
| :--- | :--- | :--- | :--- | :--- |
| **Định dạng & Tra cứu** | Tin nhắn bị trôi, cực kỳ khó tra cứu lại theo mã cổ phiếu. | Phân tích chuyên sâu bị chìm giữa các bài thảo luận vụn vặt. | Dạng một chiều, tìm kiếm theo từng mã cổ phiếu mất thời gian. | **Có cấu trúc**: Thông tin được gắn nhãn theo Mã/Ngành/Sự kiện. Tra cứu 1-click. |
| **Tính minh bạch** | Môi giới gửi ảnh chụp màn hình/Excel thủ công, dễ chỉnh sửa hậu kỳ. | Thường chỉ nhắc lại mã lãi và im lặng về mã lỗ. | Khuyến nghị rời rạc, không có bảng thống kê hiệu suất thực. | **Bất biến**: Dữ liệu giá realtime từ API SSI/DNSE. Mọi khuyến nghị được chụp snapshot JSON, cấm sửa đổi. |
| **Tự động hóa** | Phụ thuộc hoàn toàn vào sức người. Quá tải khi quy mô khách hàng tăng. | Tốn nhiều thời gian kiểm duyệt nội dung của các thành viên. | Chỉ phát thông tin một chiều, không hỗ trợ trả lời tự động chuyên sâu. | **Hybrid RAG AI**: Tự động viết nhận định thị trường theo đúng văn phong của Broker; hỗ trợ chat tra cứu nhanh. |
| **Thương hiệu Cá nhân** | Dễ lẫn lộn giữa liên lạc cá nhân và công việc chuyên môn. | Giao diện mạng xã hội mặc định, không có công cụ trực quan hóa tài chính. | Giới hạn ở văn bản tĩnh, thiếu tương tác trực quan. | **Chuyên nghiệp**: Mỗi Broker sở hữu một Workspace độc lập có biểu đồ phân bổ ngành, chart kỹ thuật. |

---

## 🛠️ Kiến trúc Hệ thống Sơ đồ & Luồng Dữ liệu

Brokerz Terminal được thiết kế theo mô hình kiến trúc phân tách rõ ràng (Decoupled Architecture), tập trung vào hiệu năng xử lý bất đồng bộ cao và bảo mật dữ liệu tuyệt đối:

```mermaid
graph TD
    subgraph Frontend [Next.js Web Client]
        A[Broker UI]
        B[Investor UI]
    end

    subgraph API_Layer [FastAPI Async Backend]
        C[Router / API Endpoints]
        D[JWT Auth / Supabase Link]
        E[Websocket Market Manager]
    end

    subgraph Data_Layer [Data Storage & RAG Engine]
        F[(PostgreSQL - Relational DB)]
        G[(ChromaDB - Vector Store)]
        H[OpenAI / Gemini LLM API]
    end
    
    subgraph Market_Feeds [Market Price Ingestion]
        I[SSI API]
        J[DNSE API]
    end

    A & B -->|HTTPS / WSS| C
    C -->|Authentication| D
    C -->|Realtime Streams| E
    E <-->|Realtime Prices| Market_Feeds
    C -->|ORM / SQL Alchemy| F
    C -->|Embeddings / Retrieval| G
    G & F <-->|Hybrid RAG Context| H
```

### 💡 Các Quyết định Kỹ thuật Nổi bật:
1. **FastAPI Async Engine**: Đảm bảo tốc độ phản hồi cực nhanh dưới 50ms cho các API truy vấn dữ liệu thị trường và chịu tải tốt cho luồng kết nối WebSocket thời gian thực.
2. **Hybrid RAG Architecture (Retrieval-Augmented Generation)**: Kết hợp việc truy xuất thông tin phi cấu trúc từ cơ sở dữ liệu Vector (ChromaDB chứa lịch sử nhận định cũ) với dữ liệu có cấu trúc thời gian thực qua API để AI viết báo cáo chính xác tuyệt đối mà không gặp hiện tượng "ảo giác" (hallucination).
3. **Event Sourcing for Portfolios**: Mọi hành động của Broker trên danh mục được lưu lại dưới dạng các Event (`portfolio_events`). Trạng thái hiện tại của danh mục được tái cấu trúc dựa trên chuỗi các sự kiện này, đảm bảo tính lịch sử không thể chối cãi.

---

## ⚙️ Hướng dẫn Setup & Chạy Local

### 📋 Yêu cầu Hệ thống
* Node.js phiên bản phù hợp với Next.js 16 (khuyên dùng Node v20+)
* Python 3.11+
* Poetry (Python Package Manager)
* PostgreSQL Database (hoặc một Supabase project có sẵn)

### 🔑 Cấu hình Biến Môi trường (.env)

Tạo file `backend/.env` và `frontend/.env.local` dựa theo `.env.example` trong repository:

#### Backend (`backend/.env`):
```env
DATABASE_URL=postgresql+psycopg2://postgres:password@db.your-project.supabase.co:5432/postgres
FRONTEND_URL=http://localhost:3000

# Cấu hình Supabase Auth
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_JWT_AUDIENCE=authenticated

# Cấu hình AI & Market API
GOOGLE_API_KEY=your-google-gemini-key
API_SECRET_KEY=your-temporary-compat-key
SSI_CONSUMER_ID=your-ssi-id
SSI_CONSUMER_SECRET=your-ssi-secret
DNSE_USERNAME=your-dnse-username
DNSE_PASSWORD=your-dnse-password
```

#### Frontend (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:50005/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_KEY=your-temporary-compat-key
```

### 🚀 Khởi chạy Ứng dụng

#### 1. Setup Backend
```bash
cd backend
# Cài đặt các thư viện thông qua Poetry
poetry install
# Chạy migration database lên phiên bản mới nhất
poetry run alembic upgrade head
# Khởi chạy server FastAPI ở chế độ dev
poetry run uvicorn src.api.main:app --host 127.0.0.1 --port 50005 --reload
```
*API Backend mặc định chạy tại:* `http://127.0.0.1:50005`

#### 2. Setup Frontend
```bash
cd frontend
# Cài đặt các thư viện Node modules
npm install
# Khởi chạy Next.js dev server
npm run dev
```
*Giao diện Frontend mặc định chạy tại:* `http://localhost:3000`

---

## 📈 Dự toán Vận hành & Tác động Thương mại (Commercial Case Study)

Brokerz Terminal không chỉ là một bài tập kỹ thuật, mà là một giải pháp có tính khả thi thương mại cực kỳ cao khi ánh xạ vào chiến lược của các công ty chứng khoán lớn như **Mirae Asset Securities Vietnam (MASVN)**:

### 1. Dự toán chi phí hạ tầng (OPEX tối ưu)
Nền tảng ứng dụng kiến trúc **Cloud-native Serverless** giúp loại bỏ hoàn toàn chi phí đầu tư thiết bị vật lý ban đầu (CAPEX), chuyển dịch sang mô hình chi phí vận hành linh hoạt theo lưu lượng sử dụng thực tế (OPEX):

| Thành phần hạ tầng | Dịch vụ đề xuất | Chi phí hàng tháng (Ước lượng) |
| :--- | :--- | :--- |
| **App Hosting & UI** | Vercel Pro (Frontend) + Hetzner / Railway (FastAPI) | $120 – $600 / tháng |
| **Database & Cache** | Supabase Pro (Postgres) + Upstash Redis + CF R2 | $340 – $1,600 / tháng |
| **AI API Costs** | Google Gemini API (Hybrid RAG Token usage) | $300 – $1,000 / tháng |
| **Bảo mật & Giám sát** | Cloudflare Enterprise Shield + Sentry + Resend | $70 – $600 / tháng |
| **Tổng OPEX ước tính** | **Duy trì vận hành toàn hệ thống cho MASVN** | **$830 – $3,800 / tháng (~21 - 96 triệu VNĐ)** |

### 2. Tác động tài chính & Doanh thu (Financial Projections)
Dựa trên thực tế thành công của các nền tảng đi trước tại Việt Nam như Techcom Securities (TCBS - tăng lợi nhuận 159% nhờ số hóa tư vấn E-Wealth) hay DNSE (lợi nhuận 2023 tăng gấp 3 lần nhờ số hóa Margin Deal và tư vấn API), Brokerz mang lại 3 giá trị tài chính thực tế cho công ty chứng khoán:
* **Bứt phá Doanh thu vay Ký quỹ (Margin)**: Lãi vay margin là nguồn thu chính của công ty chứng khoán (chiếm 57% doanh thu của MASVN năm 2025). Khi nhà đầu tư nhìn thấy hiệu suất thực tế của môi giới được hệ thống xác thực độc lập, mức độ sẵn sàng sử dụng margin an toàn sẽ tăng lên. Nếu dư nợ margin tăng từ 3 - 5%, công ty chứng khoán có thể thu thêm **50 - 85 tỷ VNĐ doanh thu lãi vay mỗi năm**.
* **Tối ưu hóa Chi phí Nhân sự**: Zalo giới hạn một môi giới chăm sóc dưới 200 khách hàng. Brokerz Terminal cùng Trợ lý AI cho phép một Broker quản lý hiệu quả tệp **hàng nghìn khách hàng VIP** mà không bị suy giảm chất lượng tư vấn, giúp nâng biên lợi nhuận mảng môi giới lên gấp nhiều lần mà không phình to quỹ lương.
* **Tạo "Rào cản Chuyển đổi" giữ chân nhân tài**: Thay vì môi giới giỏi rời đi kéo theo toàn bộ khách hàng cũ, Brokerz tích lũy mọi dữ liệu phân tích, danh mục mẫu hiệu quả cao nhiều năm và AI đã học tư duy của họ trên hệ thống của công ty. Môi giới sẽ chịu "chi phí chuyển đổi" rất lớn nếu rời đi vì họ không thể mang theo hạ tầng tri thức này, giúp giảm tỷ lệ thất thoát nhân sự giỏi về mức tối thiểu.
