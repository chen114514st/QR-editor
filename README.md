# 二维码编辑器 · README

一个纯前端的二维码生成与美化工具，支持多场景内容、模块圆角、自定义颜色、中心文字/Emoji/Logo 等样式，并可导出高清 PNG 与矢量 SVG。

---

## 功能特性

- **多场景生成**：文本 / URL、WiFi、邮箱、电话、名片（vCard）、位置（地址或经纬度）
- **样式定制**
  - 二维码尺寸（128–512px）
  - 模块圆角（0–50%）
  - 前景 / 背景颜色
  - 中心样式：无 / 文字 / Emoji / 图片 Logo
  - 中心区域大小与圆角，超过 28% 时提示扫描风险
- **高清输出**：预览使用 2 倍尺寸渲染，PNG 按所选尺寸导出，SVG 为矢量无损
- **智能纠错**：中心有内容时自动切换到 H 级纠错
- **实时预览**：输入/调整后自动刷新（防抖 80ms）
- **自定义文件名**：留空则按场景自动命名；非法字符（`\ / : * ? " < > |`）自动替换为 `_`，最长 80 字符

---

## 文件结构

| 文件 | 说明 |
| --- | --- |
| `index.html` | 主页面：UI、交互逻辑、Canvas/SVG 绘制与下载 |
| `qrcode.min.zh.js` | 二维码核心库（压缩版），提供 `QRCode.create` / `toCanvas` / `toDataURL` / `toString` |
| `qr-logo.js` | 可选增强库 `QRLogo`，提供高保真 Logo 合成（整数像素对齐、超采样、SVG 内嵌）；页面本身未依赖，供外部 JS 调用 |

页面当前直接使用 `QRCode.create` + 自定义 Canvas/SVG 绘制，`qr-logo.js` 为可选的独立增强模块，按需引入即可。

---

## 快速开始

1. 将三个文件放在同一目录：`index.html`、`qrcode.min.zh.js`、`qr-logo.js`
2. 用浏览器直接打开 `index.html`（建议通过本地服务器访问，避免 `file://` 下的某些限制）。
3. 选择场景、填写内容、调整样式，点击「下载 PNG」或「下载 SVG」。

若需使用 `qr-logo.js`，在 `index.html` 中于 `qrcode.min.zh.js` 之后引入：

```html
<script src="qrcode.min.zh.js"></script>
<script src="qr-logo.js"></script>
```

---

## 使用说明

### 场景模式

| 模式 | 生成内容格式 |
| --- | --- |
| 文本 | 原样文本 / URL |
| WiFi | `WIFI:T:<WPA\|WEP\|nopass>;S:<SSID>;P:<密码>;H:false;;` |
| 邮箱 | `mailto:...?subject=...&body=...` |
| 电话 | `tel:<号码>` |
| 名片 | vCard 3.0，自动拆分中英文姓/名，支持复姓 |
| 位置 | 地址：`https://maps.google.com/?q=...`；坐标：`geo:lat,lng` |

### 中心样式

- **文字 / Emoji**：居中绘制，自动识别 Emoji 字体
- **图片 Logo**：上传本地图片（建议 ≤ 2MB），按比例居中裁剪为圆角矩形
- 中心大小 > 28% 时会提示扫描成功率下降

### 下载

- **PNG**：按当前「尺寸」滑块值 1:1 导出；预览为 2× 高清渲染，两者尺寸不同属正常
- **SVG**：矢量输出，Logo 以 base64 内嵌，便于分享和二次编辑

---

## 技术要点

- **模块绘制**：按 `modules.get(row, col)` 逐格绘制，支持圆角矩形
- **坐标对齐**：Canvas 中 `cell = size / (N + 2*margin)`，SVG 路径以 viewBox 坐标构造，保证两者视觉一致
- **高分屏适配**：预览 canvas 按 `devicePixelRatio` 放大物理像素，CSS 尺寸不变，Retina / 手机上不发虚
- **纠错等级**：无中心内容用 M，有中心内容用 H
- **vCard 转义**：先转义反斜杠，再转义分号、逗号、冒号，换行转为字面量 `\n`，使用 CRLF 分行
- **姓名拆分**：内置常见复姓列表（欧阳、司马、上官等），英文按最后一段为姓

---

## 浏览器兼容

- 现代 Chromium / Firefox / Safari / Edge
- 依赖 `canvas.toDataURL`、`Blob`、`URL.createObjectURL`、`\p{Extended_Pictographic}` 正则（Emoji 识别）
- 移动端已做响应式适配（≤720px 单列布局）

---

## 常见问题

**Q：预览区二维码显示空白？**
A：检查 `qrcode.min.zh.js` 是否加载成功（控制台是否有 `QRCode is not defined`）。

**Q：下载 PNG 分辨率不够？**
A：预览按 2 倍尺寸渲染，导出时严格按尺寸滑块值输出；如需更大图，请调高尺寸滑块。

**Q：Logo 上传后不显示？**
A：图片需可正常解码，且 ≤ 2MB；跨域图片在 SVG 中可能无法内嵌。

**Q：WiFi 密码含特殊字符？**
A：已对反斜杠、分号、逗号、冒号、双引号做转义处理，可正常扫码连接。

---

## License

本项目仅用于学习与个人使用，二维码核心库版权归其原作者所有。