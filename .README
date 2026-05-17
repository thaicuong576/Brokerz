# Brokez Terminal

Brokez Terminal là nền tảng broker workspace giúp broker công bố nhận định, quản lý model portfolio và trao đổi với nhóm nhà đầu tư VIP trong một môi trường có đăng nhập, phân quyền và audit trail.

## Vấn đề cần giải quyết

Broker thường quản lý nhiều nhà đầu tư VIP cùng lúc, nhưng thông tin lại nằm rải rác ở nhiều nơi: nhận định thị trường, khuyến nghị mua/bán, danh mục mẫu, câu hỏi của nhà đầu tư và các cập nhật hằng ngày. Điều này tạo ra bốn vấn đề chính:

- Broker mất nhiều thời gian lặp lại cùng một cập nhật cho nhiều khách.
- Nhà đầu tư khó biết đâu là danh mục hiện tại và đâu chỉ là khuyến nghị cũ.
- Các thay đổi như mua mới, tăng tỷ trọng, giảm tỷ trọng, bán hết không có lịch sử rõ ràng.
- Dữ liệu thị trường và giá hiện tại nếu sai đơn vị hoặc thiếu fallback sẽ làm sai hiệu suất danh mục.

## Giải pháp

Brokez Terminal tập trung mọi thứ vào một broker workspace:

- Broker có workspace riêng và mời investor bằng SoulKey.
- Broker công bố daily brief, khuyến nghị và portfolio update cho toàn bộ VIP workspace.
- Portfolio là model portfolio broadcast, không phải danh mục riêng từng khách trong phase hiện tại.
- Investor xem danh mục hiện tại, lịch sử cập nhật đã công bố và có thể đặt câu hỏi trong Inquiry Hub.
- Backend ghi lại audit trail cho recommendation và portfolio events để truy vết mọi thay đổi.

## Kiến trúc tổng quan

### Frontend

- Framework: Next.js 16, React 19, TypeScript.
- UI: Tailwind CSS, lucide-react, framer-motion, recharts.
- Auth client: Supabase JS.
- API client tập trung tại `frontend/src/lib/api.ts`.
- Các màn hình chính:
  - Login/Auth.
  - Dashboard/Market Intelligence.
  - Inquiry Hub.
  - Portfolio.
  - Profile/Workspace.

### Backend

- Framework: FastAPI.
- Database: PostgreSQL/Supabase qua SQLAlchemy.
- Migration: Alembic.
- Auth: Supabase JWT verification.
- Background jobs: APScheduler, market streamer, cache flusher.
- Integrations: SSI, DNSE, Google GenAI, optional Cloudflare R2.

### Dữ liệu chính

- `profiles`: người dùng và vai trò broker/investor.
- `broker_workspaces`: workspace của broker.
- `workspace_memberships`: thành viên workspace.
- `soulkey_invites`: invite code cho investor.
- `market_prices`: giá cổ phiếu theo ngày giao dịch.
- `portfolios`, `portfolio_items`, `portfolio_events`: model portfolio và lịch sử thay đổi.
- `ws_recommendations`, `recommendation_events`: khuyến nghị và audit trail.
- `daily_briefs`: bản tin thị trường broker công bố.
- `inquiries`, `inquiry_messages`: hỏi đáp trong workspace.
- `notifications`: thông báo cho investor.

## Setup local

### Yêu cầu

- Node.js phù hợp với Next.js 16.
- Python 3.11.
- Poetry.
- PostgreSQL/Supabase project.
- Supabase Auth keys và JWT secret.

### Biến môi trường

Tạo file `backend/.env` và `frontend/.env.local` dựa theo `.env.example`.

Backend cần các biến quan trọng:

```env
DATABASE_URL=postgresql+psycopg2://...
FRONTEND_URL=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
SUPABASE_JWT_AUDIENCE=authenticated
GOOGLE_API_KEY=...
SSI_CONSUMER_ID=...
SSI_CONSUMER_SECRET=...
DNSE_USERNAME=...
DNSE_PASSWORD=...
```

Frontend cần các biến quan trọng:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:50005/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Cài đặt và chạy

### Backend

```bash
cd backend
poetry install
poetry run alembic upgrade head
poetry run uvicorn src.api.main:app --host 127.0.0.1 --port 50005 --reload
```

Backend API mặc định chạy tại:

```text
http://127.0.0.1:50005
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend mặc định chạy tại:

```text
http://localhost:3000
```

### Build frontend

```bash
cd frontend
npm run build
```

### Lint frontend

```bash
cd frontend
npm run lint
```

### Test backend

```bash
cd backend
poetry run pytest
```

Nếu chạy bằng Python global thay vì Poetry, cần đảm bảo `pytest` và các dependency backend đã được cài.

## Các tính năng đã hoàn thành

### Auth và workspace

- Đăng nhập broker/investor bằng Supabase Auth.
- Tự động resolve role BROKER/INVESTOR từ backend profile.
- Broker bootstrap workspace nếu chưa có.
- Broker chia sẻ SoulKey cho investor.
- Investor redeem SoulKey để vào workspace.
- Frontend API client có cache access token, auth listener và refresh session để giảm lỗi `401 Missing bearer token`.

### Market intelligence

- API tổng quan thị trường: market snapshot, VNINDEX, top impact, foreign trading, sector performance.
- Search stock symbol.
- Lấy latest stocks từ `market_prices`.
- Lấy giá một mã qua `/market/price/{symbol}`, có fallback live provider khi DB thiếu.
- Normalize đơn vị giá cổ phiếu: giá raw như `17850` được chuẩn hóa về `17.85`.
- Đã sửa record PC1 trong DB từ `17850/18050` về `17.85/18.05`.

### Dashboard

- Dashboard market overview.
- Sector heatmap.
- Top impact list.
- Foreign activity panel.
- Lưu layout dashboard theo workspace.

### Daily briefs và report

- Tạo draft daily brief từ market data.
- Broker có thể sửa title/content.
- Publish daily brief cho workspace.
- Investor xem latest daily brief đã publish.
- Form điều chỉnh nhận định broker trong report flow.

### Inquiry Hub

- Tạo thread hỏi đáp trong workspace.
- Hỗ trợ thread riêng tư hoặc công khai.
- Gửi/lấy tin nhắn trong thread.
- UI trợ lý soạn nháp/tóm tắt câu hỏi và phản hồi.
- Phân biệt trải nghiệm broker và investor.

### Recommendation lifecycle

- Tạo recommendation draft.
- Publish recommendation và gửi notification cho investor.
- Cập nhật thesis, target, cutloss, risk note.
- Close, reverse, archive recommendation.
- Xem history/audit trail của recommendation.

### Portfolio - model portfolio broadcast

- Portfolio được thiết kế lại thành model portfolio broadcast cho VIP workspace.
- Broker cập nhật danh mục trực tiếp qua `POST /portfolio/update-position`.
- Hỗ trợ thêm mã, mua mới, tăng tỷ trọng, giảm tỷ trọng, bán hết, cập nhật luận điểm.
- Validate tổng tỷ trọng không vượt 100%.
- Ghi `portfolio_events` cho mỗi thay đổi.
- Nếu `publish=true`, tạo recommendation/notification liên quan cho investor.
- `GET /portfolio/current` trả về metadata UI: `last_action`, `previous_weight`, `current_weight`, `last_event_at`, `last_event_note`.
- `GET /portfolio/events` trả về feed lịch sử cập nhật portfolio.

### Portfolio UI

- Tổng quan danh mục: hiệu suất, đã giải ngân, tiền mặt, số mã, cập nhật gần nhất.
- Bảng danh mục hiện tại chỉ hiển thị mã còn tỷ trọng > 0.
- Các cột chính: Mã, Vị thế, Động thái gần nhất, Tỷ trọng, Giá vốn KN, Giá hiện tại, Lãi/lỗ, Luận điểm, Thao tác.
- Form broker: Mã CP, Tỷ trọng mới, Giá áp dụng, Luận điểm gửi VIP, Rủi ro/lưu ý, Công bố cho VIP workspace.
- Feed lịch sử cập nhật hiển thị mua mới/tăng/giảm/bán hết/cập nhật luận điểm.
- Không fallback giá hiện tại về giá vốn KN nữa; nếu thiếu giá thì frontend gọi `/market/price/{symbol}`, nếu vẫn thiếu thì hiện `--`.
- Đã sửa bug P/L bị `+99900%` do lệch đơn vị giá.

## API chính

### Workspace

- `GET /api/v1/workspaces/current`
- `POST /api/v1/workspaces/bootstrap-broker`
- `POST /api/v1/workspaces/invites/verify`
- `POST /api/v1/workspaces/invites/redeem`
- `POST /api/v1/workspaces/current/leave`

### Market

- `GET /api/v1/market/snapshot`
- `GET /api/v1/stocks/latest`
- `GET /api/v1/market/price/{symbol}`
- `GET /api/v1/market/search`
- `GET /api/v1/top-impact`
- `GET /api/v1/foreign-trading`
- `GET /api/v1/sector-performance`

### Portfolio

- `GET /api/v1/portfolio/current`
- `GET /api/v1/portfolio/events`
- `POST /api/v1/portfolio/update-position`
- `POST /api/v1/portfolio/sync-strategy`

### Recommendations

- `GET /api/v1/recommendations`
- `POST /api/v1/recommendations`
- `POST /api/v1/recommendations/{id}/publish`
- `PATCH /api/v1/recommendations/{id}/thesis`
- `POST /api/v1/recommendations/{id}/close`
- `POST /api/v1/recommendations/{id}/reverse`
- `POST /api/v1/recommendations/{id}/archive`
- `GET /api/v1/recommendations/{id}/history`

### Daily briefs

- `POST /api/v1/daily-briefs/draft-from-market`
- `PATCH /api/v1/daily-briefs/{id}`
- `POST /api/v1/daily-briefs/{id}/publish`
- `GET /api/v1/daily-briefs/latest`
- `GET /api/v1/daily-briefs`

### Inquiry

- `GET /api/v1/inquiry/threads`
- `POST /api/v1/inquiry/threads`
- `GET /api/v1/inquiry/threads/{id}/messages`
- `POST /api/v1/inquiry/threads/{id}/messages`

## Validation đã thực hiện

- `python -m compileall backend/src/api/routers/portfolio.py`
- `python -m compileall backend/src/api/routers/market.py`
- `npx.cmd eslint src/components/PortfolioView.tsx`
- `npx.cmd eslint src/lib/api.ts`
- `npm.cmd run build`

## Hạn chế hiện tại

- Portfolio hiện là model portfolio chung cho workspace, chưa có danh mục riêng từng VIP.
- Chưa có module quản lý vốn từng khách, khẩu vị rủi ro, mức độ phù hợp hay trạng thái đã xem/đã chấp nhận.
- Market endpoints vẫn yêu cầu Bearer token; gọi API trực tiếp bằng browser/curl cần token hợp lệ.
- Backend tests cần chạy qua Poetry; Python global hiện có thể thiếu `pytest`.
- Một số file dữ liệu/cache có thể thay đổi khi chạy worker hoặc thao tác DB.

## Việc tiếp theo cần làm

### Sản phẩm

- Thêm CRM layer cho VIP: danh sách khách, vốn tham chiếu, risk profile, trạng thái đã xem/đã follow.
- Thêm client-fit view: model portfolio hiện tại có phù hợp với từng VIP hay không.
- Thêm trạng thái delivery/read receipt cho daily brief, recommendation và portfolio update.
- Thêm chế độ draft/publish rõ hơn cho portfolio update nếu broker muốn soạn trước.

### Portfolio

- Thêm target price, cutloss và horizon ở cấp portfolio update nếu cần.
- Thêm chart allocation theo ngành/tỷ trọng.
- Thêm export portfolio update sang PDF/Markdown để gửi ngoài hệ thống.
- Thêm undo/revert portfolio event an toàn.

### Market data

- Chuẩn hóa toàn bộ đơn vị giá trong pipeline ingestion, cache và DB.
- Thêm data quality checks cho giá bất thường, ví dụ `price >= 1000` với cổ phiếu niêm yết đang hiển thị theo đơn vị nghìn.
- Thêm job refresh giá cho các mã trong portfolio trước khi render.

### Engineering

- Bổ sung backend tests cho portfolio update-position, portfolio events và price normalization.
- Bổ sung frontend tests cho PortfolioView với các case BUY_NEW, INCREASE, DECREASE, SELL_ALL, THESIS_UPDATE.
- Dọn dẹp lint warnings cũ trong các component ngoài Portfolio.
- Làm sạch migration/seed data và tài liệu hóa quy trình deploy.
