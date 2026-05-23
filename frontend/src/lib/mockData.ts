export const MOCK_DATA = {
  profiles: {
    "broker-id": {
      id: "broker-id",
      email: "broker@brokerz.com",
      role: "broker",
      soul_key: "BKZ-ALPHA-9999",
      full_name: "Chuyên viên Tư vấn Cấp cao Alpha",
      connected_investors: 12,
      trust_rating: "99.8%"
    },
    "investor-id": {
      id: "investor-id",
      email: "investor@brokerz.com",
      role: "investor",
      following_key: "BKZ-EXPT-9901",
      full_name: "Nhà đầu tư Ưu tú Một"
    }
  },
  dashboard: {
    summary: {
      market_pe: "14.2x",
      volume_24h: "842.5M",
      breadth: { gainers: 142, losers: 48, neutral: 10 }
    },
    sectors: [
      { name: "Tài chính", value: 35, color: "#EAB308" },
      { name: "Bất động sản", value: 25, color: "#3B82F6" },
      { name: "Công nghệ", value: 20, color: "#10B981" },
      { name: "Năng lượng", value: 20, color: "#EF4444" }
    ],
    timeseries: {
      "vnindex": [
        { date: "2024-04-15", value: 1210, volume: 450 },
        { date: "2024-04-16", value: 1215, volume: 480 },
        { date: "2024-04-17", value: 1208, volume: 420 },
        { date: "2024-04-18", value: 1222, volume: 550 },
        { date: "2024-04-19", value: 1235, volume: 600 },
        { date: "2024-04-22", value: 1242, volume: 620 },
        { date: "2024-04-23", value: 1238, volume: 580 },
        { date: "2024-04-24", value: 1255, volume: 700 },
        { date: "2024-04-25", value: 1260, volume: 720 },
        { date: "2024-04-26", value: 1258, volume: 680 }
      ],
      "financials": [
        { date: "2024-04-15", value: 32, volume: 100 },
        { date: "2024-04-16", value: 33, volume: 110 },
        { date: "2024-04-17", value: 35, volume: 130 },
        { date: "2024-04-18", value: 34, volume: 120 },
        { date: "2024-04-19", value: 36, volume: 150 },
        { date: "2024-04-22", value: 38, volume: 170 },
        { date: "2024-04-23", value: 37, volume: 160 },
        { date: "2024-04-24", value: 39, volume: 190 },
        { date: "2024-04-25", value: 40, volume: 200 },
        { date: "2024-04-26", value: 35, volume: 180 }
      ]
    }
  },
  broker_portfolio: [
    { symbol: "FPT", name: "Tập đoàn FPT", weight: "25%", avg_price: "92,500", change: "+4.2%" },
    { symbol: "HPG", name: "Tập đoàn Hòa Phát", weight: "20%", avg_price: "28,200", change: "-1.5%" },
    { symbol: "VNM", name: "Vinamilk", weight: "15%", avg_price: "67,400", change: "+0.8%" },
    { symbol: "VIC", name: "Vingroup", weight: "15%", avg_price: "44,100", change: "-2.2%" },
    { symbol: "SSI", name: "Chứng khoán SSI", weight: "25%", avg_price: "34,800", change: "+5.1%" }
  ]
};

export const MARKET_DATA = MOCK_DATA.dashboard.timeseries.vnindex.map((point) => ({
  time: point.date,
  value: point.value,
}));
