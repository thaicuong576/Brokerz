# Brokerz Terminal

Brokerz Terminal là một broker workspace được xây dựng để giải quyết vấn đề cốt lõi trong quy trình tư vấn chứng khoán tại Việt Nam: các khuyến nghị đầu tư đang được quản lý qua nhóm chat Zalo/Telegram - không có cấu trúc, không có lịch sử kiểm chứng, và không thể đo lường hiệu suất một cách minh bạch.

Nền tảng cho phép broker công bố nhận định thị trường, quản lý danh mục mẫu, và trao đổi với nhà đầu tư VIP trong một môi trường có đăng nhập, phân quyền và audit trail. Mọi khuyến nghị được ghi lại dưới dạng event sourcing - không thể xóa hay chỉnh sửa lịch sử.

---

## Vấn đề cần giải quyết

Có một nghịch lý vẫn đang tồn tại trong ngành môi giới chứng khoán: các công ty chứng khoán đầu tư mạnh vào hệ thống dữ liệu và nghiên cứu thị trường, nhưng con đường từ một báo cáo phân tích chất lượng đến tay nhà đầu tư vẫn đi qua Zalo. Điều này tạo ra bốn vấn đề thực tế:

- Khuyến nghị dạng tin nhắn ngắn bị trôi, không có luận điểm đầu tư đi kèm.
- Broker có thể xóa hoặc sửa nội dung tư vấn sau khi phán đoán sai, nhà đầu tư không có cách nào truy vết.
- Một broker chỉ có thể chăm sóc 100-200 khách hàng trên Zalo trước khi bị quá tải.
- Toàn bộ dữ liệu tương tác khách hàng nằm trên server của bên thứ ba, công ty chứng khoán không kiểm soát được.

---

## Tính năng

### Xác thực và phân quyền

Brokerz tách biệt hoàn toàn giao thức làm việc giữa Broker và Investor. Nhà đầu tư kết nối với broker thông qua cơ chế **SoulKey** - một mã định danh duy nhất được broker cấp phát - thay vì phải qua email mời hay quy trình đăng ký thủ công.

| Cổng đăng nhập Broker | Cổng đăng nhập Investor |
| :---: | :---: |
| ![Broker Login](docs/images/broker-login.png) | ![Investor Login](docs/images/investor-login.png) |

Sau khi đăng nhập, investor phải xác thực qua SoulKey để mở khóa workspace của broker tương ứng.

![SoulKey Verification](docs/images/investor-verification-to-log-in.png)

---

### Broker Workspace

Workspace của broker tập trung vào ba việc: tổng hợp thông tin thị trường nhanh, quản lý danh mục có cấu trúc, và xử lý câu hỏi từ khách hàng mà không bị quá tải.

**AI Market Reporter (Hybrid RAG)**

Hệ thống tự động kéo dữ liệu thị trường cuối ngày qua API (SSI, DNSE) và tạo nháp nhận định theo văn phong của từng broker. Broker có thể điều chỉnh đánh giá kỹ thuật, bình luận vĩ mô, hoặc ghi đè bất kỳ số liệu nào trước khi phát hành.

![AI Market Reporter](docs/images/broker-1.png)

**Model Portfolio Management**

Broker thiết lập danh mục mẫu với tỷ trọng cụ thể cho từng mã, kèm luận điểm đầu tư và điều kiện thay đổi quan điểm. Hệ thống validate tổng tỷ trọng không vượt quá 100% và theo dõi hiệu suất real-time theo giá thị trường.

Vòng đời của mỗi khuyến nghị được quản lý theo trạng thái: `Draft` - `Published` - `Applied` - `Closed` / `Reversed`. Mọi thay đổi trạng thái đều được ghi lại dưới dạng JSON snapshot kèm lý do, không thể xóa hay sửa lịch sử.

![Portfolio Management](docs/images/broker-2.png)

**Inquiry Hub**

Câu hỏi của nhà đầu tư về từng mã cổ phiếu được tổ chức thành các thread độc lập thay vì cuộn theo dòng chat tuyến tính. Broker trả lời một lần, nội dung được lưu lại làm tài liệu tham chiếu cho các khách hàng mới.

![Inquiry Hub](docs/images/broker-3.png)

**Custom Dashboard**

Broker tự cấu hình bố cục workspace theo phong cách phân tích của mình - ưu tiên chart kỹ thuật, tỷ trọng ngành, hay báo cáo tài chính - thay vì dùng chung một template cứng nhắc.

![Custom Dashboard](docs/images/broker-4.png)

---

### Investor Portal

Nhà đầu tư xem danh mục mẫu hiện tại, lịch sử cập nhật đã được broker công bố, và theo dõi hiệu suất được tính theo giá thị trường real-time.

**Market Overview**

Hiển thị biến động VN-Index, HNX, Upcom, độ rộng dòng tiền ngành, và các bản tin Daily Brief từ broker.

![Investor Dashboard](docs/images/investor-1.png)

**Portfolio & Audit Trail**

Hiệu suất danh mục mẫu được tính tự động. Toàn bộ lịch sử điều chỉnh tỷ trọng, chốt lời, cắt lỗ của broker được hiển thị minh bạch - investor muốn truy vết bất kỳ quyết định nào đều có thể làm được.

![Investor Portfolio](docs/images/investor-2.png)

**Inquiry Chat**

Investor trao đổi với broker theo từng thread mã cổ phiếu. Trợ lý AI hỗ trợ gợi ý câu trả lời cho broker dựa trên lịch sử phân tích đã có.

![Investor Inquiry](docs/images/investor-3.png)

**Alerts & Profile**

Thông báo khi broker công bố cập nhật mới cho danh mục hoặc thay đổi trạng thái khuyến nghị.

![Investor Alerts](docs/images/investor-4.png)

---

## Kiến trúc hệ thống

```mermaid
graph TD
    subgraph Frontend [Next.js 16]
        A[Broker UI]
        B[Investor UI]
    end

    subgraph Backend [FastAPI - Async]
        C[API Router]
        D[Supabase Auth / JWT]
        E[WebSocket Manager]
    end

    subgraph Storage [Data Layer]
        F[(PostgreSQL - Supabase)]
        G[(ChromaDB - Vector Store)]
    end

    subgraph AI [AI Layer]
        H[Gemini / OpenAI API]
    end

    subgraph Market [Market Data]
        I[SSI API]
        J[DNSE API]
    end

    A & B -->|HTTPS / WSS| C
    C --> D
    C --> E
    E <-->|Realtime Prices| Market
    C --> F
    C --> G
    G & F <--> H
```

**Các quyết định kỹ thuật chính:**

- **FastAPI Async**: Backend bất đồng bộ để xử lý đồng thời nhiều luồng WebSocket thời gian thực và API call đến thị trường mà không bị blocking.
- **Hybrid RAG**: AI kết hợp retrieval từ ChromaDB (lưu lịch sử nhận định cũ dưới dạng vector embedding) với dữ liệu có cấu trúc real-time từ API để tạo báo cáo chính xác, tránh hallucination.
- **Event Sourcing**: Mọi thay đổi trên danh mục được lưu dưới dạng immutable event. Trạng thái hiện tại là kết quả replay của chuỗi event đó, không thể xóa hay overwrite lịch sử.
- **Supabase Auth + Row Level Security**: Phân quyền dữ liệu ở tầng database, đảm bảo investor chỉ đọc được dữ liệu của workspace broker họ đã kết nối.

---

## Hướng dẫn cài đặt

### Yêu cầu

- Python 3.11+, Poetry
- Node.js v20+
- Supabase project (PostgreSQL + Auth)

### Cấu hình môi trường

Tạo `backend/.env` và `frontend/.env.local` theo file `.env.example` trong repo.

**Backend (`backend/.env`):**
```env
DATABASE_URL=postgresql+psycopg2://postgres:password@db.your-project.supabase.co:5432/postgres
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_JWT_AUDIENCE=authenticated

GOOGLE_API_KEY=your-google-gemini-key
API_SECRET_KEY=your-api-secret-key
SSI_CONSUMER_ID=your-ssi-id
SSI_CONSUMER_SECRET=your-ssi-secret
DNSE_USERNAME=your-dnse-username
DNSE_PASSWORD=your-dnse-password
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:50005/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_KEY=your-api-secret-key
```

### Chạy local

**Backend:**
```bash
cd backend
poetry install
poetry run alembic upgrade head
poetry run uvicorn src.api.main:app --host 127.0.0.1 --port 50005 --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Backend chạy tại `http://127.0.0.1:50005`, frontend tại `http://localhost:3000`.

---

## Tech Stack

| Layer | Stack |
| :--- | :--- |
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Framer Motion |
| Backend | FastAPI, SQLAlchemy, Alembic, Poetry |
| Database | PostgreSQL (Supabase), ChromaDB |
| Auth | Supabase Auth, JWT |
| AI | Google Gemini API, Hybrid RAG |
| Market Data | SSI API, DNSE API |
| Deployment | Vercel (Frontend), Hetzner / Railway (Backend) |

---

## Bối cảnh thương mại

Dự án này được xây dựng trong bối cảnh nghiên cứu chiến lược số hóa quy trình tư vấn cho Mirae Asset Securities Vietnam (MASVN) - công ty đang giữ 4,08% thị phần môi giới trên HOSE (Q1/2026), đứng sau VPS (16,94%), SSI (9,93%), và TCBS (7,49%).

Lý do chọn góc tiếp cận này là vì mảng môi giới của MASVN có biên lợi nhuận gần bằng 0 (doanh thu 578,8 tỷ VND, chi phí 568,2 tỷ VND năm 2025). Điểm nghẽn không nằm ở hệ thống giao dịch mà nằm ở quy trình tư vấn - thứ vẫn đang chạy qua Zalo.

**Dự toán OPEX (cloud-native, không CAPEX):**

| Thành phần | Dịch vụ | Chi phí/tháng |
| :--- | :--- | :--- |
| App Hosting | Vercel Pro + Hetzner/Railway | $120 - $600 |
| Database & Cache | Supabase Pro + Upstash Redis + CF R2 | $340 - $1,600 |
| AI API | Google Gemini (RAG token usage) | $300 - $1,000 |
| Security & Monitoring | Cloudflare + Sentry + Resend | $70 - $600 |
| **Tổng** | | **$830 - $3,800/tháng** |
