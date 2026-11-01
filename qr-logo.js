/**
 * qr-logo.js  (高清增强版 v4)
 * 依赖：全局 QRCode (qrcode.min.zh.js)
 *
 * 核心改进：
 * 1. physW = (N + 2*margin) * k，k ≥ 3 → 每模块严格整数物理像素，绝对锐利
 * 2. 直接让库按 physW 出图，无二次缩放
 * 3. Logo 分「小图放大(2x 超采样)」和「大图缩小(浏览器高质量)」两条路径
 * 4. logoMarginPadding 为「相对 Logo 短边的比例」(0~0.5)，Canvas/SVG 视觉一致
 * 5. toString 统一走 callback，返回 SVG 字符串
 * 6. 圆角半径按 Logo 短边 12%，各 DPR 下视觉一致
 */
(function (global) {
  'use strict';
  if (!global.QRCode) throw new Error('请先引入 qrcode.min.zh.js');

  // ---------------- 工具 ----------------
  function loadImage(src) {
    if (typeof src === 'string') {
      return new Promise(function (res, rej) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () { res(img); };
        img.onerror = function () { rej(new Error('Logo 加载失败: ' + src)); };
        img.src = src;
      });
    }
    if (src instanceof HTMLImageElement) {
      if (src.complete && src.naturalWidth) return Promise.resolve(src);
      return new Promise(function (res, rej) {
        src.onload = function () { res(src); };
        src.onerror = function () { rej(new Error('Logo 加载失败')); };
      });
    }
    return Promise.reject(new Error('logo 必须是 URL 或 HTMLImageElement'));
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function qrOptions(opts) {
    return {
      width: opts.width,
      scale: opts.scale,
      margin: opts.margin != null ? opts.margin : 1,
      color: opts.color,
      errorCorrectionLevel: opts.errorCorrectionLevel || 'H',
      version: opts.version,
      maskPattern: opts.maskPattern
    };
  }

  // ---------------- Logo 高质量绘制 ----------------
  // 小图放大 / 尺寸接近 → 2x 超采样
  // 大图缩小 → 直接高质量 drawImage（浏览器内部有优化）
  function drawLogoHighQuality(ctx, img, x, y, w, h) {
    var sw = img.naturalWidth || img.width || 0;
    var sh = img.naturalHeight || img.height || 0;

    if (sw > w * 2 || sh > h * 2) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, x, y, w, h);
      return;
    }

    var scale = 2;
    var off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(w * scale));
    off.height = Math.max(1, Math.round(h * scale));
    var octx = off.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(img, 0, 0, off.width, off.height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, x, y, w, h);
  }

  // ---------------- Logo 布局 ----------------
  // W/H 是"当前坐标系"边长（Canvas 物理像素 或 SVG viewBox）
  // pad 为「相对 Logo 短边的比例」换算，Canvas/SVG 一致
  function layoutLogo(W, H, img, opts) {
    var iw = img.naturalWidth || img.width || 1;
    var ih = img.naturalHeight || img.height || 1;
    var ratio = opts.logoSize != null ? opts.logoSize : 0.2;

    var lw = Math.floor(W * ratio);
    var lh = Math.floor(lw * (ih / iw));
    if (lh > H * 0.5) {
      lh = Math.floor(H * 0.5);
      lw = Math.floor(lh * (iw / ih));
    }
    var lx = Math.floor((W - lw) / 2);
    var ly = Math.floor((H - lh) / 2);

    // logoMarginPadding 约定为「相对 Logo 短边的比例」(0~0.5)
    var pad;
    if (opts.logoMarginPadding != null) {
      pad = Math.max(1, Math.round(Math.min(lw, lh) * opts.logoMarginPadding));
    } else {
      pad = Math.max(1, Math.round(Math.min(lw, lh) * 0.12));
    }
    return { x: lx, y: ly, w: lw, h: lh, pad: pad };
  }

  // ---------------- 离屏二维码渲染（callback，最兼容） ----------------
  function renderQROffscreenSafe(text, opts, physW, margin) {
    return new Promise(function (resolve, reject) {
      var renderOpts = qrOptions(opts);
      renderOpts.width = physW;   // width 优先于 scale
      renderOpts.margin = margin;
      try {
        QRCode.toCanvas(text, renderOpts, function (err, cv) {
          if (err) return reject(err);
          if (!cv || !cv.width) return reject(new Error('QRCode.toCanvas 未返回 canvas'));
          resolve(cv);
        });
      } catch (e) { reject(e); }
    });
  }

  // ---------------- SVG 渲染（callback，统一返回字符串） ----------------
  function renderSVGString(text, opts) {
  return Promise.resolve().then(function () {
    var p = QRCode.toString(text, qrOptions(opts));
    if (p && typeof p.then === 'function') return p;
    if (typeof p === 'string') return p;
    throw new Error('QRCode.toString 返回类型异常');
  }).then(function (svg) {
    if (!svg || typeof svg !== 'string') {
      throw new Error('QRCode.toString 未返回 SVG 字符串');
    }
    return svg;
  });
}
  // ---------------- Canvas 主路径 ----------------
  function toCanvas(canvas, text, opts) {
    opts = opts || {};
    var dpr = opts.devicePixelRatio ||
      (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    var cssW = opts.width || 0;
    var margin = opts.margin != null ? opts.margin : 1;

    return Promise.resolve().then(function () {
      // 1. 拿模块数 N（create 不渲染，很快）
      var N = 0;
      if (global.QRCode && global.QRCode.create) {
        try { N = QRCode.create(text, qrOptions(opts)).modules.size; } catch (e) { N = 0; }
      }
      if (!N) throw new Error('无法获取二维码模块数');

      var total = N + 2 * margin;                    // 含边距的总模块数

      // 2. 每模块物理像素 k（整数，下限 3 保证肉眼锐利）
      var targetCssW = cssW || total * 4;            // 默认每模块 4 逻辑像素
      var k = Math.max(3, Math.round((targetCssW * dpr) / total));
      var physW = total * k;                          // 严格整数倍
      var targetCssActual = physW / dpr;

      // 3. 让库直接按 physW 出图
      return renderQROffscreenSafe(text, opts, physW, margin).then(function (src) {
        if (src.width !== physW) {
          console.warn('二维码实际宽 ' + src.width + ' ≠ 目标 ' + physW + '，可能被库截断');
        }

        var target = canvas || document.createElement('canvas');
        target.width = physW;
        target.height = physW;
        target.style.width = targetCssActual + 'px';
        target.style.height = targetCssActual + 'px';
        target.__qrCssWidth = targetCssActual;
        target.__qrPhysWidth = physW;

        var ctx = target.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(src, 0, 0);   // 1:1，无缩放

        if (!opts.logo) return target;

        return loadImage(opts.logo).then(function (img) {
          var L = layoutLogo(physW, physW, img, opts);
          var pad = L.pad;
          var radius = Math.max(1, Math.round(Math.min(L.w, L.h) * 0.12));

          if (opts.logoMargin !== false) {
            ctx.save();
            ctx.fillStyle = opts.logoMarginColor || '#ffffff';
            roundRect(ctx, L.x - pad, L.y - pad, L.w + pad * 2, L.h + pad * 2, radius);
            ctx.fill();
            ctx.restore();
          }

          if (opts.logoRound) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(L.x + L.w / 2, L.y + L.h / 2, Math.min(L.w, L.h) / 2, 0, Math.PI * 2);
            ctx.clip();
            drawLogoHighQuality(ctx, img, L.x, L.y, L.w, L.h);
            ctx.restore();
          } else {
            drawLogoHighQuality(ctx, img, L.x, L.y, L.w, L.h);
          }
          return target;
        });
      });
    });
  }

  // ---------------- DataURL ----------------
  function toDataURL(text, opts) {
    opts = opts || {};
    return toCanvas(undefined, text, opts).then(function (cv) {
      var type = opts.type || 'image/png';
      var quality = (opts.rendererOpts && opts.rendererOpts.quality) || 0.92;
      return cv.toDataURL(type, quality);
    });
  }

  // ---------------- SVG（Logo base64 内嵌） ----------------
  function toSVGString(text, opts) {
    opts = opts || {};
    return renderSVGString(text, opts).then(function (svg) {
      if (!opts.logo) return svg;

      return loadImage(opts.logo).then(function (img) {
        var vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
        if (!vb) return svg;
        var vbSize = parseInt(vb[1], 10);

        // layoutLogo 的 pad 是相对 Logo 短边的比例，直接适用于 viewBox 坐标
        var L = layoutLogo(vbSize, vbSize, img, opts);
        var base64 = imgToDataURL(img);
        if (!base64) return svg;

        var padVB = L.pad;  // 已是相对比例换算的整数，与 Canvas 一致
        var rxVB = Math.max(1, Math.round(Math.min(L.w, L.h) * 0.12));
        var frag = '';

        if (opts.logoMargin !== false) {
          frag += '<rect x="' + (L.x - padVB) + '" y="' + (L.y - padVB) +
            '" width="' + (L.w + padVB * 2) + '" height="' + (L.h + padVB * 2) +
            '" rx="' + rxVB + '" fill="' + (opts.logoMarginColor || '#ffffff') + '"/>';
        }

        if (opts.logoRound) {
          var cx = L.x + L.w / 2, cy = L.y + L.h / 2, r = Math.min(L.w, L.h) / 2;
          frag += '<defs><clipPath id="qrlogo-clip"><circle cx="' + cx + '" cy="' + cy +
            '" r="' + r + '"/></clipPath></defs>';
          frag += '<image x="' + L.x + '" y="' + L.y + '" width="' + L.w +
            '" height="' + L.h + '" href="' + base64 +
            '" preserveAspectRatio="xMidYMid slice" clip-path="url(#qrlogo-clip)"/>';
        } else {
          frag += '<image x="' + L.x + '" y="' + L.y + '" width="' + L.w +
            '" height="' + L.h + '" href="' + base64 +
            '" preserveAspectRatio="xMidYMid slice"/>';
        }
        return svg.replace('</svg>', frag + '</svg>');
      });
    });
  }

  function imgToDataURL(img) {
    try {
      var c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/png');
    } catch (e) {
      console.warn('Logo 跨域无法转 base64，SVG 不嵌入 Logo', e);
      return null;
    }
  }

  global.QRLogo = {
    toCanvas: toCanvas,
    toDataURL: toDataURL,
    toString: toSVGString,
    toSVG: toSVGString
  };
})(typeof window !== 'undefined' ? window : this);