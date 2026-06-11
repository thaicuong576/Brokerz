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

## Quy trình Nghiệp vụ & User Flows (BA Specification)

Dưới đây là đặc tả quy trình nghiệp vụ và các luồng tương tác (User Flows) của hệ thống Brokerz Terminal, được thiết lập theo chuẩn **Business Analysis (BA) Process**.

### 1. Phân tích 8 Điểm (8-Point Analysis)

#### 1.1. Mục tiêu (Goal)
- **Đối tượng sử dụng:** Broker (Nhà môi giới chứng khoán chuyên nghiệp) và Investor (Nhà đầu tư VIP).
- **Vấn đề giải quyết:** Số hóa và chuẩn hóa quy trình tư vấn đầu tư vốn đang bị trôi thông tin trên các nhóm chat tự phát (Zalo/Telegram); giải quyết sự thiếu minh bạch, khả năng xóa/sửa lịch sử khuyến nghị của Broker; giảm tải công việc cho Broker khi chăm sóc tệp khách hàng lớn.
- **Tiêu chí thành công:**
  - Lịch sử khuyến nghị đầu tư và biến động danh mục được lưu trữ vĩnh viễn (Event Sourced), không thể xóa/sửa.
  - Broker tạo bản tin Daily Brief hàng ngày với sự trợ giúp của AI (Hybrid RAG) chỉ trong dưới 2 phút.
  - Nhà đầu tư VIP nhận được thông báo tức thời khi có cập nhật danh mục và tương tác trực tiếp theo từng mã cổ phiếu (Inquiry Hub).

#### 1.2. Dữ liệu Đầu vào (Input)
- **Xác thực:** Thông tin đăng nhập từ Supabase Auth, mã mời SoulKey (`BKZ-XXXX-XXXX`).
- **Dữ liệu thị trường:** Dữ liệu chỉ số Index, giá cổ phiếu, khối lượng giao dịch, hoạt động của khối ngoại và độ rộng ngành được cung cấp bởi SSI API và DNSE API.
- **Dữ liệu tri thức AI:** Lịch sử các nhận định cũ của Broker đã được vector hóa và lưu trữ tại ChromaDB (Vector Store).
- **Quyết định thủ công:** Broker nhập luận điểm đầu tư, tỷ trọng cổ phiếu, mức giá khuyến nghị, đánh giá thị trường, câu trả lời Inquiry.
- **Tương tác từ Investor:** Nhà đầu tư tạo luồng hỏi đáp (Inquiry Thread) cho từng mã cổ phiếu, gửi tin nhắn.

#### 1.3. Kết quả Đầu ra (Output)
- **Bản tin Daily Brief:** Bản tin nhận định thị trường định dạng Markdown được xuất bản trên cổng Portal của nhà đầu tư.
- **Khuyến nghị & Danh mục:** Trạng thái danh mục mẫu cập nhật theo thời gian thực, lưu lại dưới dạng JSON snapshots trong `portfolio_events`.
- **Thông báo (Notifications):** Thông báo đẩy đến điện thoại/trình duyệt của Investor khi Broker cập nhật danh mục hoặc trả lời câu hỏi.
- **Hỏi đáp hỗ trợ:** Các cuộc hội thoại có cấu trúc theo mã cổ phiếu, kèm theo câu trả lời gợi ý từ AI.

#### 1.4. Các Tác nhân tham gia (Actors)
- **Broker:** Người tạo danh mục mẫu, viết nhận định thị trường, trả lời các Inquiry.
- **Investor (Nhà đầu tư):** Người theo dõi danh mục mẫu, đọc nhận định và tạo Inquiry hỏi đáp.
- **FastAPI Backend (API Router & Workers):** Hệ thống xử lý logic nghiệp vụ, đồng bộ dữ liệu thị trường và tích hợp AI.
- **Supabase (PostgreSQL & Auth):** Tầng lưu trữ dữ liệu có cấu trúc và quản lý phiên đăng nhập của người dùng.
- **ChromaDB:** Cơ sở dữ liệu Vector lưu trữ tri thức văn phong nhận định của Broker.
- **AI Engine (Google Gemini API):** Tạo bản tin Daily Brief và gợi ý câu trả lời Inquiry.
- **SSI/DNSE API:** Nguồn cấp dữ liệu giao dịch thị trường thực tế.

---

### 2. Chi tiết các Luồng Nghiệp vụ (Detailed User Flows)

#### Luồng 2.1: Xác thực & Kết nối Workspace qua SoulKey
Investor đăng ký/đăng nhập vào cổng Portal, sau đó sử dụng mã SoulKey duy nhất do Broker cung cấp để mở khóa Workspace của Broker đó.

```mermaid
sequenceDiagram
    autonumber
    actor Investor as Nhà đầu tư
    actor Broker as Broker (Chủ Workspace)
    participant FE as Frontend (Next.js)
    participant BE as Backend (FastAPI)
    participant DB as Database (PostgreSQL)

    Broker->>FE: Yêu cầu khởi tạo Workspace
    FE->>BE: POST /api/v1/workspaces/bootstrap-broker
    BE->>DB: Tạo BrokerWorkspace & WorkspaceMembership (OWNER)
    BE->>DB: Tạo SoulKeyInvite (ACTIVE) & Cập nhật soul_key của Broker
    DB-->>BE: Xác nhận lưu trữ
    BE-->>FE: Trả về Workspace + mã SoulKey (BKZ-XXXX-XXXX)
    Broker->>Investor: Gửi mã SoulKey (qua Zalo/Telegram/gặp mặt)

    Investor->>FE: Nhập mã SoulKey trên cổng Portal
    FE->>BE: POST /api/v1/workspaces/invites/verify (Kiểm tra hợp lệ)
    BE->>DB: Tra cứu soulkey_invites (code = key, status = ACTIVE)
    alt SoulKey không hợp lệ / Hết số lần sử dụng
        BE-->>FE: Trả về valid = False kèm lý do
        FE-->>Investor: Hiển thị thông báo mã SoulKey không hợp lệ
    else SoulKey hợp lệ
        BE-->>FE: Trả về valid = True kèm thông tin Broker & Workspace
        Investor->>FE: Xác nhận liên kết (Redeem)
        FE->>BE: POST /api/v1/workspaces/invites/redeem
        BE->>DB: Tạo WorkspaceMembership (MEMBER, ACTIVE)
        BE->>DB: Tăng redemption_count của SoulKey
        BE->>DB: Cập nhật linked_broker_id của Investor = owner_profile_id
        DB-->>BE: Xác nhận thành công
        BE-->>FE: Trả về thông tin Workspace mở khóa thành công
        FE-->>Investor: Chuyển hướng vào Workspace chính thức của Broker
    end
```

#### Luồng 2.2: Tạo & Xuất bản Daily Brief (AI Market Reporter)
Hệ thống tự động tổng hợp dữ liệu thị trường và kết hợp tri thức cũ để sinh nháp bản tin Daily Brief, sau đó Broker chỉnh sửa và xuất bản.

```mermaid
sequenceDiagram
    autonumber
    actor Broker as Broker (Nhà môi giới)
    participant FE as Frontend (Next.js)
    participant BE as Backend (FastAPI)
    participant AI as AI Engine (Gemini & RAG)
    participant DB as Database (PostgreSQL)
    participant VectorDB as ChromaDB (Vector Store)

    Note over BE: Định kỳ cuối ngày (hoặc trigger thủ công)
    BE->>BE: Thu thập dữ liệu giao dịch từ SSI/DNSE API
    Broker->>FE: Truy cập dashboard nhận định thị trường
    FE->>BE: POST /api/v1/report/generate (kèm bình luận thô của chuyên gia)
    BE->>BE: Khởi tạo Rich Query (Trend + Liquidity + Foreign + Raw Comment)
    BE->>VectorDB: Truy vấn k bài báo cáo cũ có ngữ cảnh tương đồng
    VectorDB-->>BE: Trả về danh sách bài báo cáo mẫu (RAG Context)
    BE->>AI: Gửi Prompt (Dữ liệu thị trường mới + RAG Context)
    AI-->>BE: Sinh bản nháp Daily Brief (Dạng Markdown)
    BE-->>FE: Trả về Daily Brief nháp
    Broker->>FE: Xem bản nháp, chỉnh sửa nội dung
    Broker->>FE: Chọn "Publish" để công bố
    FE->>BE: POST /api/v1/report/publish
    BE->>DB: Lưu bản tin với trạng thái PUBLISHED
    DB-->>BE: Xác nhận lưu thành công
    BE-->>FE: Xác nhận xuất bản thành công
    Note over FE: Nhà đầu tư truy cập Portal sẽ thấy Daily Brief mới nhất
```

#### Luồng 2.3: Khai báo Khuyến nghị & Cập nhật Danh mục Mẫu (Event Sourced Portfolio)
Mọi quyết định điều chỉnh danh mục của Broker (mua mới, tăng/giảm tỷ trọng, bán hết) đều được validate nghiêm ngặt, lưu vết lịch sử vĩnh viễn (Event Sourcing) và phát thông báo tức thì đến nhà đầu tư.

```mermaid
sequenceDiagram
    autonumber
    actor Broker as Broker (Nhà môi giới)
    participant FE as Frontend (Next.js)
    participant BE as Backend (FastAPI)
    participant DB as Database (PostgreSQL)
    actor Investor as Nhà đầu tư VIP

    Broker->>FE: Yêu cầu cập nhật tỷ trọng mã (Symbol, Target Weight, Price, Thesis)
    FE->>BE: POST /api/v1/portfolio/update-position
    BE->>DB: Lấy snapshot danh mục hiện tại (before_state)
    BE->>BE: Validate: Tổng tỷ trọng các mã khác + Target Weight <= 100%
    alt Tổng tỷ trọng vượt quá 100%
        BE-->>FE: Trả về lỗi 400 (Tổng tỷ trọng không vượt quá 100%)
        FE-->>Broker: Hiển thị cảnh báo vượt hạn mức
    else Tỷ trọng hợp lệ
        BE->>BE: Xác định Action (BUY_NEW, INCREASE, DECREASE, SELL_ALL)
        alt Chọn công bố (publish = true)
            BE->>DB: Tạo WsRecommendation (PUBLISHED) & RecommendationEvent (CREATED, PUBLISHED)
            BE->>DB: Tạo Notification gửi tới toàn bộ thành viên Workspace
        end
        BE->>DB: Cập nhật hoặc xóa PortfolioItem tương ứng
        BE->>DB: Tạo PortfolioEvent (Lưu before_state, after_state dạng JSON, note)
        DB-->>BE: Xác nhận Commit Transaction
        BE-->>FE: Trả về PortfolioResponse mới cập nhật
        FE-->>Broker: Hiển thị danh mục mới và log audit trail
        Note over Investor: Nhận Notification & xem biến động danh mục trên Portal
    end
```

#### Luồng 2.4: Hỏi đáp theo mã cổ phiếu & Trợ lý AI gợi ý câu trả lời (Inquiry Hub)
Hệ thống tổ chức câu hỏi của nhà đầu tư thành các luồng độc lập theo mã cổ phiếu. AI tự động gợi ý phản hồi giúp Broker tối ưu hóa năng suất chăm sóc khách hàng.

```mermaid
sequenceDiagram
    autonumber
    actor Investor as Nhà đầu tư VIP
    actor Broker as Broker (Nhà môi giới)
    participant FE as Frontend (Next.js)
    participant BE as Backend (FastAPI)
    participant AI as AI Engine (Gemini)
    participant DB as Database (PostgreSQL)

    Investor->>FE: Tạo câu hỏi mới (mã chứng khoán, nội dung)
    FE->>BE: POST /api/v1/inquiry/threads
    BE->>DB: Tạo Inquiry (status: OPEN) & InquiryMessage ban đầu
    DB-->>BE: Lưu thành công
    BE-->>FE: Trả về luồng hỏi đáp mới khởi tạo
    BE->>DB: Tạo Notification gửi tới Broker
    
    Broker->>FE: Mở luồng Inquiry mới nhận được
    FE->>BE: GET /api/v1/inquiry/threads/{id}/suggest-reply (Gọi gợi ý từ AI)
    BE->>AI: Truy vấn Gemini (kèm nội dung câu hỏi + luận điểm của danh mục hiện tại)
    AI-->>BE: Trả về gợi ý câu trả lời
    BE-->>FE: Hiển thị câu trả lời nháp từ AI cho Broker
    Broker->>FE: Chỉnh sửa câu trả lời nháp
    Broker->>FE: Bấm "Gửi phản hồi"
    FE->>BE: POST /api/v1/inquiry/threads/{id}/messages
    BE->>DB: Lưu InquiryMessage chính thức & đổi trạng thái Inquiry
    BE->>DB: Tạo Notification gửi tới Investor
    DB-->>BE: Lưu thành công
    BE-->>FE: Hiển thị tin nhắn mới trong luồng chat
    Note over Investor: Nhận Notification và xem câu trả lời của Broker trên Portal
```

---

### 3. Quy tắc Nghiệp vụ (Business Rules)

1. **Tính Bất biến của Lịch sử (Portfolio Immutability):** Không cho phép bất kỳ hành động xóa (DELETE) hoặc cập nhật trực tiếp (UPDATE) bản ghi `portfolio_events` hay `recommendation_events` nào. Mọi thay đổi đều được ghi lại dưới dạng JSON snapshot mới để đảm bảo khả năng truy vết tuyệt đối.
2. **Kiểm soát Tỷ trọng Danh mục (Total Weight Constraint):** Tổng tỷ trọng của tất cả các cổ phiếu đang hoạt động trong danh mục mẫu mẫu (`PortfolioItem.weight`) luôn phải đảm bảo $\le 100.0\%$. Mọi giao dịch dẫn đến việc vượt quá giới hạn này sẽ bị chặn ngay tại API Gateway của Backend.
3. **Phân quyền và Rào chắn Dữ liệu (Row Level Security & Isolation):** Nhà đầu tư chỉ được phép xem danh mục mẫu, bản tin Daily Brief, và các Inquiry công khai từ Broker mà mình đang liên kết (`linked_broker_id`). Quyền ghi nhận định thị trường và chỉnh sửa danh mục hoàn toàn thuộc về Broker sở hữu Workspace.
4. **Mã mời SoulKey:** Một SoulKey của Broker có giới hạn số lần mở khóa (`max_redemptions`). Hệ thống phải tự động tăng `redemption_count` mỗi lần có Investor tham gia và khóa mã khi đạt giới hạn.

---

### 4. Tiêu chí Nghiệm thu (Acceptance Criteria)

- [ ] **Xác thực SoulKey:** Investor nhập đúng SoulKey của Broker sẽ hiển thị chính xác tên Broker và Workspace tương ứng. Nhập SoulKey sai/thu hồi/quá giới hạn lập tức hiển thị thông báo lỗi chi tiết.
- [ ] **Lưu vết Danh mục (Event Sourced Portfolio):** Khi Broker thay đổi danh mục, một bản ghi `portfolio_events` mới được tạo với `before_state` và `after_state` chứa đầy đủ cấu trúc JSON của danh mục trước và sau khi thay đổi.
- [ ] **Bản tin Daily Brief AI:** Bản tin Daily Brief nháp được tạo ra phải chứa cấu trúc Markdown chuẩn, không gặp lỗi định dạng và tổng hợp đúng các trường thông tin thị trường (VNINDEX, thanh khoản, khối ngoại).
- [ ] **Hỏi đáp và gợi ý AI:** Trợ lý AI gợi ý phản hồi trong Inquiry Hub phải dựa trên mã cổ phiếu được hỏi, có văn phong chuyên nghiệp và trích xuất đúng luận điểm phân tích của Broker (nếu có trong hệ thống).
- [ ] **Bất đồng bộ & Realtime:** Investor nhận được thông báo thay đổi danh mục hoặc có câu trả lời mới của Broker trong vòng dưới 2 giây kể từ khi sự kiện xảy ra trên hệ thống.

---

### 5. Trường hợp Ngoại lệ & Kịch bản Rủi ro (Pre-Mortem & Edge Cases)

#### 5.1. Kịch bản Rủi ro & Cách khắc phục (Pre-Mortem Analysis)
1. **Rủi ro 1: Lỗi kết nối / Quá hạn mức (Rate Limit) API Google Gemini.**
   - *Hệ quả:* Hệ thống không thể sinh nháp Daily Brief hoặc gợi ý phản hồi cho Broker, gây gián đoạn quy trình làm việc.
   - *Khắc phục:* Sử dụng cơ chế Fallback (trả về mẫu nhận định thị trường thuần túy dựa trên các quy tắc cứng) kết hợp xếp hàng đợi retry (Exponential Backoff). Hiển thị tùy chọn nhập nội dung thủ công cho Broker kèm thông báo hệ thống AI đang quá tải.
2. **Rủi ro 2: Dữ liệu thị trường SSI/DNSE bị trễ hoặc lỗi trong giờ giao dịch.**
   - *Hệ quả:* Dữ liệu hiển thị sai lệch hoặc không thể tạo bản tin Daily Brief tự động đúng giờ.
   - *Khắc phục:* Cache dữ liệu thị trường gần nhất. Nếu API nhà cung cấp lỗi quá 3 lần, hệ thống tự động đánh dấu nguồn dữ liệu là `TEMP` (hoặc `EOD` cũ) và hiển thị cảnh báo cho Broker biết để kiểm tra lại trước khi phê duyệt.

#### 5.2. Các trường hợp ngoại lệ (Edge Cases)
- **SoulKey của Broker bị vô hiệu hóa khi Investor đang kết nối:** Hệ thống phải thu hồi quyền truy cập Workspace của Investor đó ngay ở phiên làm việc tiếp theo và hướng dẫn Investor liên hệ Broker để nhận mã mới.
- **Thanh khoản thị trường bùng nổ vượt ngưỡng đo lường:** Khi giá trị giao dịch vượt các mốc thông thường (ví dụ: > 35,000 tỷ VND), logic sinh nhận định phải xử lý linh hoạt (không bị hardcode lỗi phân tách chuỗi số) và đưa ra cảnh báo "Thanh khoản đột biến lịch sử".
- **Hỏi đáp về mã cổ phiếu lạ chưa có dữ liệu trong hệ thống:** Trợ lý AI tự động phản hồi chung về sự thiếu hụt dữ liệu phân tích lịch sử của mã này và gợi ý Broker thực hiện phân tích cơ bản thủ công.

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
