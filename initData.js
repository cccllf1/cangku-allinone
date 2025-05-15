db = db.getSiblingDB('cangku');

db.products.insertMany([
  { code: "P001", name: "商品1", unit: "件", image: "https://picsum.photos/200?random=1" },
  { code: "P002", name: "商品2", unit: "件", image: "https://picsum.photos/200?random=2" },
  { code: "P003", name: "商品3", unit: "件", image: "https://picsum.photos/200?random=3" },
  { code: "P004", name: "商品4", unit: "件", image: "https://picsum.photos/200?random=4" },
  { code: "P005", name: "商品5", unit: "件", image: "https://picsum.photos/200?random=5" },
  { code: "P006", name: "商品6", unit: "件", image: "https://picsum.photos/200?random=6" },
  { code: "P007", name: "商品7", unit: "件", image: "https://picsum.photos/200?random=7" },
  { code: "P008", name: "商品8", unit: "件", image: "https://picsum.photos/200?random=8" },
  { code: "P009", name: "商品9", unit: "件", image: "https://picsum.photos/200?random=9" },
  { code: "P010", name: "商品10", unit: "件", image: "https://picsum.photos/200?random=10" },
  { code: "P011", name: "商品11", unit: "件", image: "https://picsum.photos/200?random=11" },
  { code: "P012", name: "商品12", unit: "件", image: "https://picsum.photos/200?random=12" },
  { code: "P013", name: "商品13", unit: "件", image: "https://picsum.photos/200?random=13" },
  { code: "P014", name: "商品14", unit: "件", image: "https://picsum.photos/200?random=14" },
  { code: "P015", name: "商品15", unit: "件", image: "https://picsum.photos/200?random=15" },
  { code: "P016", name: "商品16", unit: "件", image: "https://picsum.photos/200?random=16" },
  { code: "P017", name: "商品17", unit: "件", image: "https://picsum.photos/200?random=17" },
  { code: "P018", name: "商品18", unit: "件", image: "https://picsum.photos/200?random=18" },
  { code: "P019", name: "商品19", unit: "件", image: "https://picsum.photos/200?random=19" },
  { code: "P020", name: "商品20", unit: "件", image: "https://picsum.photos/200?random=20" }
]);

db.cargos.insertMany([
  { code: "C001", name: "货物1", desc: "描述1" },
  { code: "C002", name: "货物2", desc: "描述2" },
  { code: "C003", name: "货物3", desc: "描述3" },
  { code: "C004", name: "货物4", desc: "描述4" },
  { code: "C005", name: "货物5", desc: "描述5" },
  { code: "C006", name: "货物6", desc: "描述6" },
  { code: "C007", name: "货物7", desc: "描述7" },
  { code: "C008", name: "货物8", desc: "描述8" },
  { code: "C009", name: "货物9", desc: "描述9" },
  { code: "C010", name: "货物10", desc: "描述10" }
]); 