import { supabase } from "./supabase";
import { MOCK_DATA } from "./mockData";

const USE_MOCK = false;
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:50005/api/v1").replace(/\/$/, "");

type RequestOptions = RequestInit & {
  auth?: boolean;
};

async function getAccessToken() {
  if (typeof window === "undefined") return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

async function request(pathOrUrl: string, options: RequestOptions = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE}${pathOrUrl}`;
  const token = options.auth === false ? null : await getAccessToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API_FAILURE: ${response.status} - ${errorText}`);
  }
  return response;
}

export interface MeProfile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  role: "BROKER" | "INVESTOR";
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  owner_profile_id: string;
  role: "OWNER" | "MEMBER";
  invite_code?: string | null;
}

export interface CurrentWorkspace {
  profile_role: "BROKER" | "INVESTOR";
  workspace?: WorkspaceSummary | null;
}

export interface LegacyProfile {
  id?: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string;
  soul_key?: string | null;
  linked_broker_id?: string | null;
  broker_name?: string | null;
}

export interface WsRecommendationResponse {
  id: string;
  workspace_id: string;
  broker_id: string;
  symbol: string;
  side: "BUY" | "SELL";
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
  entry_price?: number | null;
  target_price?: number | null;
  cutloss_price?: number | null;
  thesis?: string | null;
  risk_note?: string | null;
  closed_reason?: string | null;
  current_price?: number | null;
  performance_pct?: number | null;
  published_at?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RecommendationEventResponse {
  id: string;
  event_type: string;
  actor_id: string;
  note?: string | null;
  before_state?: string | null;
  after_state?: string | null;
  created_at?: string | null;
}

export const apiService = {
  async secureFetch(url: string, options: RequestOptions = {}) {
    return request(url, options);
  },

  async getMe(): Promise<MeProfile> {
    const response = await request("/me");
    return response.json();
  },

  async getCurrentWorkspace(): Promise<CurrentWorkspace> {
    const response = await request("/workspaces/current");
    return response.json();
  },

  async bootstrapBrokerWorkspace(data: { name?: string; description?: string } = {}): Promise<WorkspaceSummary> {
    const response = await request("/workspaces/bootstrap-broker", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async verifySoulKey(key: string) {
    if (USE_MOCK) return { valid: key.startsWith("BKZ-") };
    const response = await request("/workspaces/invites/verify", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ code: key }),
    });
    return response.json();
  },

  async redeemSoulKey(key: string) {
    const response = await request("/workspaces/invites/redeem", {
      method: "POST",
      body: JSON.stringify({ code: key }),
    });
    return response.json();
  },

  async getProfile(userId: string, role?: string, name?: string, avatar?: string): Promise<LegacyProfile> {
    if (USE_MOCK) return MOCK_DATA.profiles[userId as keyof typeof MOCK_DATA.profiles] || MOCK_DATA.profiles["investor-id"];
    const [me, currentWorkspace] = await Promise.all([
      this.getMe(),
      this.getCurrentWorkspace().catch(() => null),
    ]);
    return {
      id: me.id,
      full_name: me.full_name || name || "User",
      role: me.role,
      avatar_url: me.avatar_url || avatar,
      soul_key: currentWorkspace?.workspace?.invite_code || null,
      linked_broker_id: currentWorkspace?.workspace?.owner_profile_id || null,
      broker_name: currentWorkspace?.workspace?.name || null,
    };
  },

  async linkBroker(_userId: string, key: string) {
    return this.redeemSoulKey(key);
  },

  async unlinkBroker(_userId: string) {
    const response = await request("/workspaces/current/leave", { method: "POST" });
    return response.json();
  },

  async getDashboardData() {
    if (USE_MOCK) return { summary: MOCK_DATA.dashboard.summary };
    const response = await request("/overview");
    const summary = await response.json();
    return { summary };
  },

  async getMarketSnapshot() {
    const response = await request("/market/snapshot");
    return response.json();
  },

  async getLatestStocks() {
    const response = await request("/stocks/latest");
    return response.json();
  },

  async getMyStrategy(_userId: string) {
    const response = await request("/portfolio/my-strategy");
    return response.json();
  },

  async syncStrategy(_userId: string, data: any) {
    const response = await request("/portfolio/sync-strategy", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  },

  // --- New Recommendation Lifecycle API ---

  async getWsRecommendations(statusFilter?: string): Promise<WsRecommendationResponse[]> {
    const qs = statusFilter ? `?status_filter=${statusFilter}` : "";
    const response = await request(`/recommendations${qs}`);
    return response.json();
  },

  async getWsRecommendation(recId: string): Promise<WsRecommendationResponse> {
    const response = await request(`/recommendations/${recId}`);
    return response.json();
  },

  async createWsRecommendation(data: {
    symbol: string;
    side: string;
    entry_price?: number;
    target_price?: number;
    cutloss_price?: number;
    thesis?: string;
    risk_note?: string;
  }): Promise<WsRecommendationResponse> {
    const response = await request("/recommendations", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async publishRecommendation(recId: string): Promise<WsRecommendationResponse> {
    const response = await request(`/recommendations/${recId}/publish`, { method: "POST" });
    return response.json();
  },

  async updateRecommendationThesis(recId: string, data: {
    thesis?: string;
    target_price?: number;
    cutloss_price?: number;
    risk_note?: string;
    note?: string;
  }): Promise<WsRecommendationResponse> {
    const response = await request(`/recommendations/${recId}/thesis`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async closeRecommendation(recId: string, reason: string, note?: string): Promise<WsRecommendationResponse> {
    const response = await request(`/recommendations/${recId}/close`, {
      method: "POST",
      body: JSON.stringify({ reason, note }),
    });
    return response.json();
  },

  async archiveRecommendation(recId: string): Promise<WsRecommendationResponse> {
    const response = await request(`/recommendations/${recId}/archive`, { method: "POST" });
    return response.json();
  },

  async getRecommendationHistory(recId: string): Promise<RecommendationEventResponse[]> {
    const response = await request(`/recommendations/${recId}/history`);
    return response.json();
  },

  // --- Legacy recommendation methods (deprecated, kept for backward compat) ---

  async getRecommendations() {
    const response = await request("/portfolio/recommendations");
    return response.json();
  },

  async createRecommendation(_userId: string, data: any) {
    const response = await request("/portfolio/recommendations", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async deleteRecommendation(recId: string) {
    const response = await request(`/portfolio/recommendations/${recId}`, { method: "DELETE" });
    return response.json();
  },

  async updateRecommendation(recId: string, data: any) {
    const response = await request(`/portfolio/recommendations/${recId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return response.json();
  },


  async searchStocks(query: string) {
    const response = await request(`/market/search?q=${encodeURIComponent(query)}`);
    return response.json();
  },

  async getStockPrice(symbol: string) {
    const response = await request(`/market/price/${symbol}`);
    return response.json();
  },

  async getTimeseries(datasetId: string) {
    if (USE_MOCK) return MOCK_DATA.dashboard.timeseries[datasetId as keyof typeof MOCK_DATA.dashboard.timeseries] || [];
    const response = await request(`/analytics/timeseries?id=${encodeURIComponent(datasetId)}`);
    return response.json();
  },

  async getStrategyAssets(brokerKey: string) {
    if (USE_MOCK) return MOCK_DATA.broker_portfolio;
    const response = await request(`/portfolio/assets?key=${encodeURIComponent(brokerKey)}`);
    return response.json();
  },

  async getSamplePortfolios() {
    return [];
  },

  async getInquiryThreads(_userId: string) {
    const response = await request("/inquiry/threads");
    return response.json();
  },

  async createInquiryThread(_userId: string, data: { title: string; is_private: boolean; initial_message: string; image_url?: string }) {
    const response = await request("/inquiry/threads", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async getThreadMessages(threadId: string) {
    const response = await request(`/inquiry/threads/${threadId}/messages`);
    return response.json();
  },

  async addThreadMessage(threadId: string, _userId: string, content: string, image_url?: string) {
    const response = await request(`/inquiry/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, image_url }),
    });
    return response.json();
  },

  async getNotifications(_userId: string) {
    const response = await request("/notification");
    return response.json();
  },

  async markNotificationRead(notifId: string) {
    const response = await request(`/notification/${notifId}/read`, { method: "POST" });
    return response.json();
  },

  async markAllNotificationsRead(_userId: string) {
    const response = await request("/notification/read-all", { method: "POST" });
    return response.json();
  },
};

const api = {
  async get(path: string) {
    const response = await request(path);
    return { data: await response.json() };
  },
  async post(path: string, body?: any) {
    const response = await request(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { data: await response.json() };
  },
};

export default api;
