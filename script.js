(() => {
  "use strict";

  const F = window.Fracao;
  const MT = window.Matrizes;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const reduzirMovimento = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // localStorage pode lançar erro em navegadores in-app e janelas privadas.
  const guardar = {
    ler(chave) {
      try {
        return localStorage.getItem(chave);
      } catch (e) {
        return null;
      }
    },
    gravar(chave, valor) {
      try {
        localStorage.setItem(chave, valor);
      } catch (e) {
        /* sem armazenamento: o tema só não fica salvo */
      }
    },
  };

  function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // =====================================================================
  // Tema
  // =====================================================================

  const temaBtn = $("#tema");

  function aplicarTema(tema) {
    document.documentElement.setAttribute("data-theme", tema);
    temaBtn.setAttribute("aria-label", tema === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
  }

  aplicarTema(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");

  temaBtn.addEventListener("click", () => {
    const novo = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    guardar.gravar("tema", novo);
    aplicarTema(novo);
  });

  // =====================================================================
  // Tela de abertura: o plano sendo transformado por uma matriz 2×2
  // =====================================================================

  const intro = $("#intro");
  const app = $("#app");

  const palco = (() => {
    const canvas = $(".intro-canvas");
    const ctx = canvas.getContext("2d");
    const alvo = $(".intro-palco");
    const celulasLeitura = $$(".leitura-mtx .mtx-cel");
    const detLeitura = $("#leitura-det");

    // [a, b, c, d] representa [[a, b], [c, d]]: î vai para (a, c) e ĵ para (b, d).
    const r = Math.SQRT1_2;
    const QUADROS = [
      [1, 0, 0, 1], // identidade
      [1, 1, 0, 1], // cisalhamento
      [r, -r, r, r], // rotação de 45°
      [1.6, 0.4, 0.2, 0.7], // esticar
      [-1, 0.5, 0, 1], // reflexão (det passa por zero e fica negativo)
      [0.6, -1, 1, 0.5],
    ];
    const PAUSA = 1.5;
    const TRANSICAO = 2.4;

    let larg = 0;
    let alt = 0;
    let dpr = 1;
    let ox = 0;
    let oy = 0;
    let u = 56;
    let rodando = false;
    let raf = 0;
    let inicio = 0;
    let ultimaLeitura = 0;

    function medir() {
      const rs = intro.getBoundingClientRect();
      const ra = alvo.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      larg = rs.width;
      alt = rs.height;
      canvas.width = Math.round(larg * dpr);
      canvas.height = Math.round(alt * dpr);
      canvas.style.width = `${larg}px`;
      canvas.style.height = `${alt}px`;
      ox = ra.left - rs.left + ra.width * 0.5;
      oy = ra.top - rs.top + Math.min(ra.height * 0.42, ra.height - 230);
      u = Math.max(44, Math.min(116, Math.min(ra.width, ra.height) / 4.6));
    }

    const suave = (t) => t * t * (3 - 2 * t);

    function matrizNoTempo(seg) {
      const ciclo = PAUSA + TRANSICAO;
      const total = ciclo * QUADROS.length;
      const t = ((seg % total) + total) % total; // nunca negativo, mesmo se o relógio vier adiantado
      const k = Math.floor(t / ciclo);
      const dentro = t - k * ciclo;
      const de = QUADROS[k];
      const para = QUADROS[(k + 1) % QUADROS.length];
      const p = dentro < PAUSA ? 0 : suave((dentro - PAUSA) / TRANSICAO);
      return de.map((v, i) => v + (para[i] - v) * p);
    }

    const X = (x, y, M) => ox + (M[0] * x + M[1] * y) * u;
    const Y = (x, y, M) => oy - (M[2] * x + M[3] * y) * u;

    function linha(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    function seta(x, y, cor, rotulo) {
      const comp = Math.hypot(x - ox, y - oy);
      if (comp < 3) return;
      const ang = Math.atan2(y - oy, x - ox);
      const ponta = Math.min(13, comp * 0.45);
      const bx = x - Math.cos(ang) * ponta;
      const by = y - Math.sin(ang) * ponta;
      const px = Math.cos(ang + Math.PI / 2) * ponta * 0.55;
      const py = Math.sin(ang + Math.PI / 2) * ponta * 0.55;
      ctx.strokeStyle = cor;
      ctx.fillStyle = cor;
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      linha(ox, oy, bx, by);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(bx + px, by + py);
      ctx.lineTo(bx - px, by - py);
      ctx.closePath();
      ctx.fill();
      ctx.font = "italic 600 22px 'STIX Two Text', Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(rotulo, x + Math.cos(ang) * 16, y + Math.sin(ang) * 16);
    }

    function desenhar(M) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, larg, alt);
      const alcance = Math.ceil(Math.hypot(larg, alt) / u) + 2;

      // Malha original, parada, bem de leve.
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(184, 146, 255, 0.06)";
      for (let k = -alcance; k <= alcance; k++) {
        linha(ox + k * u, 0, ox + k * u, alt);
        linha(0, oy - k * u, larg, oy - k * u);
      }

      // Malha transformada: as retas continuam retas e paralelas (transformação linear).
      const S = alcance * 3;
      for (let k = -alcance; k <= alcance; k++) {
        ctx.strokeStyle = k === 0 ? "rgba(255, 255, 255, 0.4)" : "rgba(184, 146, 255, 0.2)";
        ctx.lineWidth = k === 0 ? 1.4 : 1;
        linha(X(k, -S, M), Y(k, -S, M), X(k, S, M), Y(k, S, M));
        linha(X(-S, k, M), Y(-S, k, M), X(S, k, M), Y(S, k, M));
      }

      // Imagem do quadrado unitário: área = |det M|.
      const det = M[0] * M[3] - M[1] * M[2];
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(X(1, 0, M), Y(1, 0, M));
      ctx.lineTo(X(1, 1, M), Y(1, 1, M));
      ctx.lineTo(X(0, 1, M), Y(0, 1, M));
      ctx.closePath();
      ctx.fillStyle = det >= 0 ? "rgba(255, 122, 26, 0.24)" : "rgba(184, 146, 255, 0.26)";
      ctx.fill();
      ctx.strokeStyle = det >= 0 ? "rgba(255, 170, 110, 0.6)" : "rgba(201, 168, 255, 0.6)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      seta(X(0, 1, M), Y(0, 1, M), "#c9a8ff", "ĵ");
      seta(X(1, 0, M), Y(1, 0, M), "#ff8a33", "î");

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ox, oy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    function fmt(v) {
      if (Math.abs(v) < 0.005) return "0,00";
      const t = v.toFixed(2).replace(".", ",");
      return t[0] === "-" ? `−${t.slice(1)}` : t;
    }

    function atualizarLeitura(M, agora, forcar) {
      if (!forcar && agora - ultimaLeitura < 70) return;
      ultimaLeitura = agora;
      celulasLeitura.forEach((el, i) => {
        el.textContent = fmt(M[i]);
      });
      detLeitura.textContent = fmt(M[0] * M[3] - M[1] * M[2]);
    }

    function quadro(agora) {
      if (!rodando) return;
      // Agenda o próximo quadro antes de desenhar: um erro num quadro não pode matar a animação.
      raf = requestAnimationFrame(quadro);
      try {
        // O timestamp do quadro pode vir um pouco antes de `inicio` (Safari, cliques no começo do quadro).
        const M = matrizNoTempo(Math.max(0, agora - inicio) / 1000);
        desenhar(M);
        atualizarLeitura(M, agora);
      } catch (e) {
        console.error(e);
      }
    }

    function desenharParado() {
      const M = QUADROS[3];
      desenhar(M);
      atualizarLeitura(M, 0, true);
    }

    function iniciar() {
      medir();
      if (reduzirMovimento) {
        desenharParado();
        return;
      }
      if (rodando) return;
      rodando = true;
      // Começa já perto do fim da primeira pausa, para o movimento aparecer logo.
      inicio = performance.now() - (PAUSA - 0.3) * 1000;
      raf = requestAnimationFrame(quadro);
    }

    function parar() {
      rodando = false;
      cancelAnimationFrame(raf);
    }

    window.addEventListener("resize", () => {
      if (intro.hidden) return;
      medir();
      if (!rodando) desenharParado();
    });

    // A fonte matemática chega depois do primeiro quadro; remede quando ela carregar.
    // (medir() limpa o canvas, então redesenha se a animação estiver parada.)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (intro.hidden) return;
        medir();
        if (!rodando) desenharParado();
      });
    }

    // Voltar pelo botão "voltar" do navegador pode restaurar a página com o loop parado.
    window.addEventListener("pageshow", () => {
      if (intro.hidden) return;
      parar();
      iniciar();
    });

    return { iniciar, parar };
  })();

  // =====================================================================
  // Operações e estado
  // =====================================================================

  const DIM_MIN = 1;
  const DIM_MAX = 8;
  const N_MAX = 12;

  const OPS = [
    { id: "soma", expr: "<i>A</i> + <i>B</i>", nome: "Soma", usaB: true },
    { id: "subtracao", expr: "<i>A</i> − <i>B</i>", nome: "Subtração", usaB: true },
    { id: "escalar", expr: "<i>k</i> · <i>A</i>", nome: "Por escalar", usaK: true },
    { id: "produto", expr: "<i>A</i> · <i>B</i>", nome: "Produto", usaB: true },
    { id: "transposta", expr: "<i>A</i><sup>t</sup>", nome: "Transposta" },
    { id: "determinante", expr: "det <i>A</i>", nome: "Determinante", quadA: true },
    { id: "inversa", expr: "<i>A</i><sup>−1</sup>", nome: "Inversa", quadA: true },
    { id: "potencia", expr: "<i>A</i><sup>n</sup>", nome: "Potência", quadA: true, usaN: true },
    { id: "divisao", expr: "<i>A</i> · <i>B</i><sup>−1</sup>", nome: "“Divisão”", usaB: true, quadB: true },
  ];
  const opPorId = Object.fromEntries(OPS.map((o) => [o.id, o]));

  // Exemplos de livro: escolhidos para mostrar algo interessante em cada operação.
  const EXEMPLOS = {
    soma: { A: [["1", "-2", "3"], ["0", "4", "-1"]], B: [["5", "1", "-3"], ["2", "-2", "6"]] },
    subtracao: { A: [["7", "2"], ["-1", "5"]], B: [["3", "-4"], ["2", "5"]] },
    escalar: { A: [["1", "-2"], ["3", "1/2"]], k: "-3" },
    produto: { A: [["2", "-1", "0"], ["1", "3", "-2"]], B: [["1", "4"], ["0", "-1"], ["5", "2"]] },
    transposta: { A: [["1", "2", "3"], ["4", "5", "6"]] },
    determinante: { A: [["2", "-1", "3"], ["1", "0", "4"], ["-2", "5", "1"]] },
    inversa: { A: [["2", "0", "1"], ["1", "1", "0"], ["0", "3", "1"]] },
    potencia: { A: [["1", "1"], ["1", "0"]], n: 10 },
    divisao: { A: [["3", "1"], ["2", "4"]], B: [["1", "2"], ["1", "3"]] },
  };

  const vazia = () => MT.criar(DIM_MAX, DIM_MAX, () => "");

  const estado = {
    op: "produto",
    A: { m: 2, n: 3, v: vazia() },
    B: { m: 3, n: 2, v: vazia() },
    k: "-3",
    n: 2,
    formato: "fracao",
    sel: [0, 0],
    // Enquanto o usuário não mexer em nada, trocar de operação carrega o exemplo dela.
    exemploIntocado: true,
  };

  function carregarExemplo(id) {
    const ex = EXEMPLOS[id];
    const aplicar = (nome, linhas) => {
      if (!linhas) return;
      const s = estado[nome];
      s.v = vazia();
      s.m = linhas.length;
      s.n = linhas[0].length;
      linhas.forEach((l, i) => l.forEach((x, j) => (s.v[i][j] = x)));
    };
    aplicar("A", ex.A);
    aplicar("B", ex.B);
    if (ex.k !== undefined) {
      estado.k = ex.k;
      entradaK.value = ex.k;
      entradaK.classList.remove("invalida");
    }
    if (ex.n !== undefined) estado.n = ex.n;
    estado.sel = [0, 0];
    estado.exemploIntocado = true;
  }

  // Matrizes quadradas quando a operação exige.
  function aplicarRestricoes() {
    const op = opPorId[estado.op];
    if (op.quadA) estado.A.n = estado.A.m;
    if (op.quadB) estado.B.n = estado.B.m;
  }

  // =====================================================================
  // Editores das matrizes
  // =====================================================================

  const colEntrada = $("#col-entrada");
  const campoK = $("#campo-k");
  const campoN = $("#campo-n");
  const entradaK = $("#entrada-k");
  const valorN = $("#valor-n");
  const opsEl = $("#ops");
  const trocarBtn = $("#trocar-ab");
  const editores = {};

  function stepperHTML(dim, rotulo) {
    return `
      <div class="stepper" data-dim="${dim}">
        <span class="stepper-rotulo">${rotulo}</span>
        <div class="stepper-ctrl">
          <button type="button" data-delta="-1" aria-label="Diminuir ${rotulo.toLowerCase()}">−</button>
          <output data-valor></output>
          <button type="button" data-delta="1" aria-label="Aumentar ${rotulo.toLowerCase()}">+</button>
        </div>
      </div>`;
  }

  function criarEditor(nome) {
    const letra = nome.toLowerCase();
    const el = document.createElement("section");
    el.className = `cartao editor reveal cor-${letra}`;
    el.id = `editor-${letra}`;
    el.setAttribute("aria-label", `Matriz ${nome}`);
    el.innerHTML = `
      <header class="editor-topo">
        <h2 class="editor-nome"><i>${nome}</i><span class="editor-ordem" data-ordem></span></h2>
        <span class="editor-foco" data-foco aria-hidden="true"></span>
      </header>
      <div class="dims">
        ${stepperHTML("m", "Linhas")}
        ${stepperHTML("n", "Colunas")}
        ${stepperHTML("ordem", "Ordem")}
      </div>
      <div class="grade-rolagem">
        <div class="mtx mtx-colchetes grade" data-grade></div>
      </div>
      <div class="editor-acoes">
        <button type="button" class="chip" data-acao="aleatoria">Aleatória</button>
        <button type="button" class="chip" data-acao="identidade">Identidade</button>
        <button type="button" class="chip" data-acao="zerar">Zerar</button>
      </div>`;

    const ed = {
      el,
      nome,
      letra,
      grade: $("[data-grade]", el),
      ordem: $("[data-ordem]", el),
      foco: $("[data-foco]", el),
    };
    editores[nome] = ed;

    el.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.delta) mudarDim(nome, btn.closest(".stepper").dataset.dim, Number(btn.dataset.delta));
      else if (btn.dataset.acao) acaoEditor(nome, btn.dataset.acao);
    });

    ed.grade.addEventListener("input", (e) => {
      const inp = e.target;
      estado[nome].v[inp.dataset.i][inp.dataset.j] = inp.value;
      estado.exemploIntocado = false;
      validarCampo(inp, inp.value);
      agendarCalculo();
    });

    ed.grade.addEventListener("focusin", (e) => {
      const inp = e.target;
      if (!(inp instanceof HTMLInputElement)) return;
      ed.foco.innerHTML = `<i>${letra}</i><sub>${Number(inp.dataset.i) + 1}${Number(inp.dataset.j) + 1}</sub>`;
      ed.foco.classList.add("ativo");
      requestAnimationFrame(() => inp.select());
    });

    ed.grade.addEventListener("focusout", () => ed.foco.classList.remove("ativo"));
    ed.grade.addEventListener("keydown", (e) => navegarGrade(e, nome));

    return ed;
  }

  function validarCampo(inp, texto) {
    let ok = true;
    try {
      F.ler(texto);
    } catch (err) {
      ok = false;
    }
    inp.classList.toggle("invalida", !ok);
    inp.setAttribute("aria-invalid", ok ? "false" : "true");
  }

  function renderGrade(nome) {
    const ed = editores[nome];
    const s = estado[nome];
    ed.grade.style.setProperty("--cols", s.n);
    ed.ordem.textContent = `${s.m} × ${s.n}`;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < s.m; i++) {
      for (let j = 0; j < s.n; j++) {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.className = "mtx-cel celula";
        inp.value = s.v[i][j];
        inp.placeholder = "0";
        inp.autocomplete = "off";
        inp.spellcheck = false;
        inp.setAttribute("autocapitalize", "off");
        inp.setAttribute("enterkeyhint", "next");
        inp.dataset.i = i;
        inp.dataset.j = j;
        inp.setAttribute("aria-label", `${nome}: linha ${i + 1}, coluna ${j + 1}`);
        validarCampo(inp, s.v[i][j]);
        frag.appendChild(inp);
      }
    }
    ed.grade.replaceChildren(frag);
  }

  function atualizarSteppers(nome) {
    const ed = editores[nome];
    const s = estado[nome];
    const op = opPorId[estado.op];
    const quadrada = (nome === "A" && op.quadA) || (nome === "B" && op.quadB);
    $$(".stepper", ed.el).forEach((st) => {
      const dim = st.dataset.dim;
      st.hidden = quadrada ? dim !== "ordem" : dim === "ordem";
      const valor = dim === "ordem" ? s.m : s[dim];
      $("[data-valor]", st).textContent = valor;
      $('[data-delta="-1"]', st).disabled = valor <= DIM_MIN;
      $('[data-delta="1"]', st).disabled = valor >= DIM_MAX;
    });
  }

  function mudarDim(nome, dim, delta) {
    const s = estado[nome];
    const limitar = (x) => Math.max(DIM_MIN, Math.min(DIM_MAX, x));
    if (dim === "ordem") {
      s.m = limitar(s.m + delta);
      s.n = s.m;
    } else {
      s[dim] = limitar(s[dim] + delta);
    }
    estado.exemploIntocado = false;
    atualizarSteppers(nome);
    renderGrade(nome);
    calcular();
  }

  function sortear() {
    return String(Math.floor(Math.random() * 15) - 5); // inteiros de −5 a 9
  }

  function acaoEditor(nome, acao) {
    const s = estado[nome];
    if (acao === "zerar") {
      s.v = vazia();
    } else if (acao === "identidade") {
      s.n = s.m;
      s.v = MT.criar(DIM_MAX, DIM_MAX, (i, j) => (i === j ? "1" : "0"));
    } else if (acao === "aleatoria") {
      // Para inversa/divisão, evita sortear matriz singular.
      const precisaInvertivel = (nome === "A" && estado.op === "inversa") || (nome === "B" && estado.op === "divisao");
      for (let tentativa = 0; tentativa < 30; tentativa++) {
        s.v = MT.criar(DIM_MAX, DIM_MAX, () => sortear());
        if (!precisaInvertivel || s.m !== s.n) break;
        const M = MT.criar(s.m, s.n, (i, j) => F.ler(s.v[i][j]));
        if (!MT.determinante(M).ehZero) break;
      }
    }
    estado.exemploIntocado = false;
    atualizarSteppers(nome);
    renderGrade(nome);
    calcular({ animar: true });
  }

  // Setas e Enter andam pela grade como numa planilha.
  function navegarGrade(e, nome) {
    const inp = e.target;
    if (!(inp instanceof HTMLInputElement) || e.ctrlKey || e.metaKey || e.altKey) return;
    const s = estado[nome];
    let i = Number(inp.dataset.i);
    let j = Number(inp.dataset.j);
    const fim = inp.value.length;
    const tudoSelecionado = inp.selectionStart === 0 && inp.selectionEnd === fim;

    if (e.key === "ArrowUp") i--;
    else if (e.key === "ArrowDown") i++;
    else if (e.key === "ArrowLeft" && (inp.selectionStart === 0 && (inp.selectionEnd === 0 || tudoSelecionado))) j--;
    else if (e.key === "ArrowRight" && (inp.selectionEnd === fim && (inp.selectionStart === fim || tudoSelecionado))) j++;
    else if (e.key === "Enter") {
      j++;
      if (j >= s.n) {
        j = 0;
        i++;
      }
      if (i >= s.m) {
        e.preventDefault();
        const op = opPorId[estado.op];
        if (nome === "A" && op.usaB) {
          const primeira = $("input", editores.B.grade);
          if (primeira) primeira.focus();
        } else {
          inp.blur();
          calcular({ animar: true });
          rolarParaResultado();
        }
        return;
      }
    } else return;

    const alvo = $(`input[data-i="${i}"][data-j="${j}"]`, editores[nome].grade);
    if (alvo) {
      e.preventDefault();
      alvo.focus();
    }
  }

  // =====================================================================
  // Notação matemática em HTML
  // =====================================================================

  function numHTML(f, o = {}) {
    if (o.formato === "decimal") {
      const d = f.decimal(4);
      let t = (d.exato ? "" : "≈") + d.texto;
      if (o.par && f.ehNegativo) t = `(${t})`;
      return `<span class="num">${t}</span>`;
    }
    const neg = f.ehNegativo;
    const n = (neg ? -f.num : f.num).toString();
    let corpo = f.den === 1n ? n : `<span class="fr"><span class="fr-n">${n}</span><span class="fr-d">${f.den}</span></span>`;
    if (neg) corpo = `−${corpo}`;
    if (o.par && neg) corpo = `(${corpo})`;
    return `<span class="num">${corpo}</span>`;
  }

  const varHTML = (letra, i, j) => `<span class="var"><i>${letra}</i><sub>${i + 1}${j + 1}</sub></span>`;
  const L = (i) => `<span class="var">L<sub>${i + 1}</sub></span>`;
  const op = (s) => `<span class="eq-op">${s}</span>`;

  function ord(nome, m, n, o = {}) {
    const mm = o.realcarM ? `<b class="${o.realcarM}">${m}</b>` : m;
    const nn = o.realcarN ? `<b class="${o.realcarN}">${n}</b>` : n;
    return `<span class="ord">${nome}<sub>${mm}×${nn}</sub></span>`;
  }

  function matrizHTML(M, o = {}) {
    const { cor = "", tipo = "colchetes", formato = "fracao", celula, classe, attrs, sep = -1, tam = "" } = o;
    const cols = M[0].length;
    let h = `<span class="mtx mtx-${tipo}${cor ? ` cor-${cor}` : ""}${tam ? ` mtx-${tam}` : ""}" style="--cols:${cols}">`;
    M.forEach((linha, i) =>
      linha.forEach((v, j) => {
        let cls = "mtx-cel";
        if (j === sep) cls += " sep";
        const extra = classe ? classe(i, j) : "";
        if (extra) cls += ` ${extra}`;
        h += `<span class="${cls}"${attrs ? ` ${attrs(i, j)}` : ""}>${celula ? celula(v, i, j) : numHTML(v, { formato })}</span>`;
      })
    );
    return `${h}</span>`;
  }

  // "8 + 1 − 3": soma de termos com o sinal já resolvido.
  function somaHTML(termos) {
    return termos
      .map((t, k) => {
        if (k === 0) return `<span class="nw">${numHTML(t)}</span>`;
        return `<span class="nw">${t.ehNegativo ? `${op("−")} ${numHTML(t.oposto())}` : `${op("+")} ${numHTML(t)}`}</span>`;
      })
      .join(" ");
  }

  // Bloco de contas alinhado pelo sinal de igual.
  function contasHTML(lhs, linhas) {
    return `<div class="contas">${linhas
      .map((rhs, k) => `<div class="contas-lhs"><span>${k === 0 ? lhs : ""}</span></div><div class="contas-rhs">${op("=")} <span class="contas-valor">${rhs}</span></div>`)
      .join("")}</div>`;
  }

  const eqHTML = (...partes) => `<div class="eq">${partes.map((p) => `<span>${p}</span>`).join("")}</div>`;

  function nota(html, tipo = "info") {
    const icone = { info: "i", alerta: "!", ok: "✓", curiosidade: "★" }[tipo];
    return `<div class="nota nota-${tipo}"><span class="nota-icone" aria-hidden="true">${icone}</span><div>${html}</div></div>`;
  }

  function passosHTML(lista) {
    return `<ol class="passos-lista">${lista
      .map(
        (p, k) => `
        <li class="passo" style="--i:${k}">
          <span class="passo-num">${k + 1}</span>
          <div class="passo-corpo"><h3>${p.t}</h3>${p.c}</div>
        </li>`
      )
      .join("")}</ol>`;
  }

  const sigmaHTML = (sup, inf) =>
    `<span class="sigma"><span class="sigma-lim">${sup}</span><span class="sigma-simb">Σ</span><span class="sigma-lim">${inf}</span></span>`;

  // =====================================================================
  // Peças reutilizadas no passo a passo
  // =====================================================================

  /* Produto interativo: tocar num elemento de C acende a linha de A
     e a coluna de B usadas, e mostra a conta completa. */
  function produtoInterativoHTML(A, B, C, nomes) {
    return `
      <div class="produto" data-produto>
        <div class="produto-vis rolagem-x">
          <div class="produto-mtx"><span class="produto-nome">${nomes.A}</span>${matrizHTML(A, { cor: "a", tam: "media", attrs: (i, j) => `data-pa="${i}-${j}"` })}</div>
          ${op("·")}
          <div class="produto-mtx"><span class="produto-nome">${nomes.B}</span>${matrizHTML(B, { cor: "b", tam: "media", attrs: (i, j) => `data-pb="${i}-${j}"` })}</div>
          <div class="produto-res">${op("=")}
          <div class="produto-mtx"><span class="produto-nome">${nomes.C}</span>${matrizHTML(C, {
            cor: "c",
            tam: "media",
            classe: () => "clicavel",
            attrs: (i, j) => `data-pc="${i}-${j}" tabindex="0" role="button" aria-label="Ver a conta do elemento linha ${i + 1}, coluna ${j + 1}"`,
          })}</div></div>
        </div>
        <p class="produto-dica">Toque ou passe o mouse em um elemento de ${nomes.C} para ver a conta.</p>
        <div class="produto-conta" data-conta></div>
      </div>`;
  }

  function contaProdutoHTML(A, B, C, i, j, letras) {
    const p = B.length;
    const ks = Array.from({ length: p }, (_, k) => k);
    const linhas = [];
    const termo = (k, html) => `<span class="nw">${k > 0 ? `${op("+")} ` : ""}${html}</span>`;
    if (letras.simbolico) linhas.push(ks.map((k) => termo(k, `${varHTML(letras.a, i, k)}·${varHTML(letras.b, k, j)}`)).join(" "));
    linhas.push(ks.map((k) => termo(k, `${numHTML(A[i][k], { par: true })}·${numHTML(B[k][j], { par: true })}`)).join(" "));
    if (p > 1) linhas.push(somaHTML(ks.map((k) => A[i][k].vezes(B[k][j]))));
    linhas.push(`<strong class="destaque-c">${numHTML(C[i][j])}</strong>`);
    const titulo = `Linha ${i + 1} de ${letras.nomeA} <span class="x">×</span> coluna ${j + 1} de ${letras.nomeB}`;
    return `<p class="conta-titulo">${titulo}</p>${contasHTML(varHTML(letras.c, i, j), linhas)}`;
  }

  function ligarProduto(box, A, B, C, letras) {
    const conta = $("[data-conta]", box);
    const selecionar = (i, j) => {
      estado.sel = [i, j];
      $$("[data-pa]", box).forEach((el) => el.classList.toggle("lit", Number(el.dataset.pa.split("-")[0]) === i));
      $$("[data-pb]", box).forEach((el) => el.classList.toggle("lit", Number(el.dataset.pb.split("-")[1]) === j));
      $$("[data-pc]", box).forEach((el) => el.classList.toggle("sel", el.dataset.pc === `${i}-${j}`));
      conta.innerHTML = contaProdutoHTML(A, B, C, i, j, letras);
    };
    const doEvento = (e) => {
      const cel = e.target.closest("[data-pc]");
      if (!cel) return;
      const [i, j] = cel.dataset.pc.split("-").map(Number);
      if (estado.sel[0] !== i || estado.sel[1] !== j || !conta.innerHTML) selecionar(i, j);
    };
    box.addEventListener("click", doEvento);
    box.addEventListener("mouseover", doEvento);
    box.addEventListener("focusin", doEvento);
    const [si, sj] = estado.sel;
    selecionar(si < C.length ? si : 0, sj < C[0].length ? sj : 0);
  }

  function opGaussHTML(o) {
    const coef = (k) => {
      if (k.ehUm) return "";
      return `${numHTML(k, { par: true })}·`;
    };
    if (o.tipo === "troca") return `${L(o.i)} ↔ ${L(o.j)}`;
    if (o.tipo === "escala") {
      if (o.k.igual(F.UM.oposto())) return `${L(o.i)} → −${L(o.i)}`;
      return `${L(o.i)} → ${coef(o.k)}${L(o.i)}`;
    }
    const sinal = o.k.ehNegativo ? "+" : "−";
    return `${L(o.i)} → ${L(o.i)} ${op(sinal)} ${coef(o.k.abs())}${L(o.j)}`;
  }

  function gaussJordanPassoHTML(gj, n) {
    let h = `<p>Escrevemos a matriz aumentada [ <i>A</i> | <i>I</i> ] e aplicamos operações elementares nas linhas até a parte esquerda virar a identidade.</p>`;
    h += `<div class="gj-etapa"><span class="gj-rotulo">Início</span><div class="rolagem-x">${matrizHTML(gj.inicial, { sep: n, tam: "pequena" })}</div></div>`;
    gj.etapas.forEach((et) => {
      h += `
        <div class="gj-etapa">
          <span class="gj-rotulo">Coluna ${et.coluna + 1}</span>
          <ul class="gj-ops">${et.ops.map((o) => `<li>${opGaussHTML(o)}</li>`).join("")}</ul>
          <div class="rolagem-x">${matrizHTML(et.matriz, { sep: n, tam: "pequena", classe: (i, j) => (j === et.coluna ? "col-pivo" : "") })}</div>
        </div>`;
    });
    h += `<p>A parte esquerda virou <i>I</i>${sub(n)}, então a parte direita é <i>A</i><sup>−1</sup>.</p>`;
    return h;
  }

  const SUBS = "₀₁₂₃₄₅₆₇₈₉";
  function sub(n) {
    return String(n)
      .split("")
      .map((d) => SUBS[Number(d)])
      .join("");
  }

  /* Regra de Sarrus desenhada: matriz com as duas primeiras colunas
     repetidas e as diagonais traçadas por cima (SVG medido no DOM). */
  function sarrusHTML(A) {
    let h = `<div class="sarrus" data-sarrus><div class="sarrus-grade">`;
    h += `<span class="sarrus-barra" style="grid-column:1;grid-row:1/4"></span>`;
    h += `<span class="sarrus-barra" style="grid-column:5;grid-row:1/4"></span>`;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const col = c < 3 ? c + 2 : c + 3;
        h += `<span class="sarrus-cel${c >= 3 ? " repetida" : ""}" data-sc="${r}-${c}" style="grid-row:${r + 1};grid-column:${col}">${numHTML(A[r][c % 3])}</span>`;
      }
    }
    return `${h}</div><svg class="sarrus-svg" aria-hidden="true"></svg></div>`;
  }

  function desenharSarrus(box, s) {
    const svg = $(".sarrus-svg", box);
    const base = box.getBoundingClientRect();
    if (!base.width) return;
    svg.setAttribute("viewBox", `0 0 ${base.width} ${base.height}`);
    svg.setAttribute("width", base.width);
    svg.setAttribute("height", base.height);
    const centro = (r, c) => {
      const el = $(`[data-sc="${r}-${c}"]`, box).getBoundingClientRect();
      return [el.left - base.left + el.width / 2, el.top - base.top + el.height / 2];
    };
    let h = "";
    [
      ["p", s.principais],
      ["s", s.secundarias],
    ].forEach(([tipo, diagonais]) =>
      diagonais.forEach((d, k) => {
        const [x1, y1] = centro(...d.celulas[0]);
        const [x2, y2] = centro(...d.celulas[2]);
        const comp = Math.hypot(x2 - x1, y2 - y1) || 1;
        const ex = ((x2 - x1) / comp) * 14;
        const ey = ((y2 - y1) / comp) * 14;
        h += `<line class="sarrus-linha ${tipo}" data-diag="${tipo}${k}" x1="${x1 - ex}" y1="${y1 - ey}" x2="${x2 + ex}" y2="${y2 + ey}"/>`;
      })
    );
    svg.innerHTML = h;
  }

  function ligarSarrus(container, s) {
    const box = $("[data-sarrus]", container);
    if (!box) return;
    const desenhar = () => desenharSarrus(box, s);
    redesenhos.push(desenhar);
    requestAnimationFrame(desenhar);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(desenhar);

    const realcar = (id) => {
      $$(".sarrus-linha", box).forEach((l) => l.classList.toggle("ativa", l.dataset.diag === id));
      $$(".sarrus-linha", box).forEach((l) => l.classList.toggle("apagada", !!id && l.dataset.diag !== id));
      $$("[data-sc]", box).forEach((c) => c.classList.remove("ativa"));
      $$("[data-diag-termo]", container).forEach((t) => t.classList.toggle("ativo", t.dataset.diagTermo === id));
      if (!id) return;
      const lista = id[0] === "p" ? s.principais : s.secundarias;
      lista[Number(id.slice(1))].celulas.forEach(([r, c]) => $(`[data-sc="${r}-${c}"]`, box).classList.add("ativa"));
    };
    $$("[data-diag-termo]", container).forEach((t) => {
      t.addEventListener("mouseenter", () => realcar(t.dataset.diagTermo));
      t.addEventListener("mouseleave", () => realcar(null));
      t.addEventListener("click", () => realcar(t.dataset.diagTermo));
    });
  }

  /* Interpretação geométrica do determinante 2×2: as colunas de A geram
     um paralelogramo de área |det A| (imagem do quadrado unitário). */
  function geometria2x2HTML(A, det) {
    const a = A[0][0].paraNumero();
    const b = A[0][1].paraNumero();
    const c = A[1][0].paraNumero();
    const d = A[1][1].paraNumero();
    const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [a, c], [b, d], [a + b, c + d]];
    let minX = Math.min(...pts.map((p) => p[0]));
    let maxX = Math.max(...pts.map((p) => p[0]));
    let minY = Math.min(...pts.map((p) => p[1]));
    let maxY = Math.max(...pts.map((p) => p[1]));
    const alcance = Math.max(maxX - minX, maxY - minY, 2);
    const folga = alcance * 0.14 + 0.4;
    minX -= folga;
    maxX += folga;
    minY -= folga;
    maxY += folga;
    const w = maxX - minX;
    const h = maxY - minY;
    const passo = alcance <= 14 ? 1 : Math.ceil(alcance / 12);
    const fs = Math.max(w, h) / 20;
    const P = (x, y) => `${x.toFixed(3)},${(-y).toFixed(3)}`;

    let g = "";
    for (let x = Math.ceil(minX / passo) * passo; x <= maxX; x += passo) g += `<line class="vg-grade" x1="${x}" y1="${-maxY}" x2="${x}" y2="${-minY}"/>`;
    for (let y = Math.ceil(minY / passo) * passo; y <= maxY; y += passo) g += `<line class="vg-grade" x1="${minX}" y1="${-y}" x2="${maxX}" y2="${-y}"/>`;
    g += `<line class="vg-eixo" x1="${minX}" y1="0" x2="${maxX}" y2="0"/><line class="vg-eixo" x1="0" y1="${-maxY}" x2="0" y2="${-minY}"/>`;
    g += `<polygon class="vg-unit" points="${P(0, 0)} ${P(1, 0)} ${P(1, 1)} ${P(0, 1)}"/>`;
    const sinal = det.ehZero ? "zero" : det.ehNegativo ? "neg" : "pos";
    g += `<polygon class="vg-par vg-${sinal}" points="${P(0, 0)} ${P(a, c)} ${P(a + b, c + d)} ${P(b, d)}"/>`;

    const vetor = (x, y, classe, rotulo) => {
      const comp = Math.hypot(x, y);
      if (comp < 1e-9) return `<circle class="${classe}-ponta" cx="0" cy="0" r="${fs * 0.25}"/>`;
      const ponta = Math.min(fs * 0.9, comp * 0.4);
      const ux = x / comp;
      const uy = y / comp;
      const bx = x - ux * ponta;
      const by = y - uy * ponta;
      const px = -uy * ponta * 0.5;
      const py = ux * ponta * 0.5;
      return `<line class="${classe}" x1="0" y1="0" x2="${bx}" y2="${-by}"/>
        <polygon class="${classe}-ponta" points="${P(x, y)} ${P(bx + px, by + py)} ${P(bx - px, by - py)}"/>
        <text class="vg-rotulo ${classe}-txt" x="${x + ux * fs * 0.9}" y="${-(y + uy * fs * 0.9)}" font-size="${fs}" text-anchor="middle" dominant-baseline="middle">${rotulo}</text>`;
    };
    g += vetor(b, d, "vg-v2", "c₂");
    g += vetor(a, c, "vg-v1", "c₁");

    let legenda;
    if (det.ehZero) {
      legenda = `As colunas de <i>A</i> são <strong>paralelas</strong>: o paralelogramo “achata” num segmento e a área é <strong>0</strong>. Por isso det <i>A</i> = 0 e <i>A</i> não tem inversa.`;
    } else {
      legenda = `As colunas <b class="txt-a">c₁</b> e <b class="txt-b">c₂</b> de <i>A</i> formam um paralelogramo de área <span class="var">|det <i>A</i>|</span> = ${numHTML(det.abs())}. É a imagem do quadrado unitário (tracejado, área 1).`;
      if (det.ehNegativo) legenda += ` O sinal negativo indica que a transformação <strong>inverte a orientação</strong> do plano.`;
    }

    return `
      <figure class="geo">
        <svg class="geo-svg" viewBox="${minX} ${-maxY} ${w} ${h}" role="img" aria-label="Paralelogramo formado pelas colunas de A">${g}</svg>
        <figcaption>${legenda}</figcaption>
      </figure>`;
  }

  // =====================================================================
  // Cálculos (cada um devolve título, regra, resultado e passo a passo)
  // =====================================================================

  function regraMesmaOrdem(A, B, nomeOp) {
    const [m, n] = [A.length, A[0].length];
    const [p, q] = [B.length, B[0].length];
    if (m === p && n === q) {
      return { ok: true, html: `${ord("<i>A</i>", m, n)} e ${ord("<i>B</i>", p, q)} têm a mesma ordem → ${ord("<i>C</i>", m, n)}` };
    }
    return {
      ok: false,
      html: `A ${nomeOp} só é definida para matrizes de <strong>mesma ordem</strong>, mas ${ord("<i>A</i>", m, n)} e ${ord("<i>B</i>", p, q)} são diferentes.`,
      conserto: {
        rotulo: `Ajustar B para ${m} × ${n}`,
        acao: () => {
          estado.B.m = m;
          estado.B.n = n;
        },
      },
    };
  }

  function somaOuSubtracao(A, B, ehSoma) {
    const nomeOp = ehSoma ? "soma" : "subtração";
    const s = ehSoma ? "+" : "−";
    const titulo = `<i>C</i> ${op("=")} <i>A</i> ${op(s)} <i>B</i>`;
    const regra = regraMesmaOrdem(A, B, nomeOp);
    if (!regra.ok) return { titulo, regra, resultado: null, passos: "" };

    const C = ehSoma ? MT.somar(A, B) : MT.subtrair(A, B);
    const expandida = matrizHTML(A, {
      tam: "media",
      classe: () => "expandida",
      celula: (a, i, j) => `${numHTML(a)} ${op(s)} ${numHTML(B[i][j], { par: true })}`,
    });
    const passos = passosHTML([
      {
        t: "A regra",
        c: `<p>${ehSoma ? "Somam-se" : "Subtraem-se"} os elementos que ocupam a <strong>mesma posição</strong>:</p>
            ${eqHTML(ij("c"), op("="), ij("a"), op(s), ij("b"))}`,
      },
      { t: "Elemento a elemento", c: `<div class="rolagem-x">${eqHTML("<i>C</i>", op("="), expandida)}</div>` },
      { t: "Resultado", c: `<div class="rolagem-x">${eqHTML("<i>C</i>", op("="), matrizHTML(C, { cor: "c", tam: "media" }))}</div>` },
    ]);
    const extra = ehSoma
      ? nota("A soma de matrizes é <strong>comutativa</strong>: <i>A</i> + <i>B</i> = <i>B</i> + <i>A</i>.")
      : nota("Subtrair é somar a oposta: <i>A</i> − <i>B</i> = <i>A</i> + (−<i>B</i>). Diferente da soma, <i>A</i> − <i>B</i> ≠ <i>B</i> − <i>A</i> em geral.");
    return { titulo, regra, resultado: { tipo: "matriz", M: C, nome: "C" }, passos: passos + extra };
  }

  const ij = (letra) => `<span class="var"><i>${letra}</i><sub>ij</sub></span>`;

  const CALCULOS = {
    soma: ({ A, B }) => somaOuSubtracao(A, B, true),
    subtracao: ({ A, B }) => somaOuSubtracao(A, B, false),

    escalar: ({ A, k }) => {
      const [m, n] = [A.length, A[0].length];
      const titulo = `<i>C</i> ${op("=")} ${numHTML(k, { par: true })} · <i>A</i>`;
      const C = MT.escalar(k, A);
      const regra = { ok: true, html: `Definido para qualquer matriz: ${ord("<i>C</i>", m, n)} tem a mesma ordem de ${ord("<i>A</i>", m, n)}` };
      let extra = "";
      if (k.ehZero) extra = nota("Multiplicar por 0 dá a <strong>matriz nula</strong>.");
      else if (k.igual(F.UM.oposto())) extra = nota("(−1)·<i>A</i> = −<i>A</i> é a <strong>matriz oposta</strong> de <i>A</i>: <i>A</i> + (−<i>A</i>) = 0.");
      else if (!k.ehInteiro && k.num === 1n) extra = nota(`Multiplicar por ${numHTML(k)} é o mesmo que <strong>dividir cada elemento por ${k.den}</strong>. É assim que se “divide” uma matriz por um número.`);
      const passos = passosHTML([
        { t: "A regra", c: `<p>Multiplica-se <strong>cada elemento</strong> de <i>A</i> pelo número <i>k</i> = ${numHTML(k)}:</p>${eqHTML(ij("c"), op("="), "<i>k</i> ·", ij("a"))}` },
        {
          t: "Elemento a elemento",
          c: `<div class="rolagem-x">${eqHTML("<i>C</i>", op("="), matrizHTML(A, { tam: "media", classe: () => "expandida", celula: (a) => `${numHTML(k, { par: true })}·${numHTML(a, { par: true })}` }))}</div>`,
        },
        { t: "Resultado", c: `<div class="rolagem-x">${eqHTML("<i>C</i>", op("="), matrizHTML(C, { cor: "c", tam: "media" }))}</div>` },
      ]);
      return { titulo, regra, resultado: { tipo: "matriz", M: C, nome: "C" }, passos: passos + extra };
    },

    produto: ({ A, B }) => {
      const [m, p] = [A.length, A[0].length];
      const [p2, q] = [B.length, B[0].length];
      const titulo = `<i>C</i> ${op("=")} <i>A</i> · <i>B</i>`;
      if (p !== p2) {
        return {
          titulo,
          regra: {
            ok: false,
            html: `${ord("<i>A</i>", m, p, { realcarN: "dim-falha" })} · ${ord("<i>B</i>", p2, q, { realcarM: "dim-falha" })} — o produto só existe se o <strong>nº de colunas de A</strong> (${p}) for igual ao <strong>nº de linhas de B</strong> (${p2}).`,
            conserto: {
              rotulo: `Ajustar B para ${p} × ${q}`,
              acao: () => {
                estado.B.m = p;
              },
            },
          },
          resultado: null,
          passos: "",
        };
      }
      const C = MT.multiplicar(A, B);
      const regra = {
        ok: true,
        html: `${ord("<i>A</i>", m, p, { realcarN: "dim-ok" })} · ${ord("<i>B</i>", p2, q, { realcarM: "dim-ok" })} = ${ord("<i>C</i>", m, q)} — colunas de A = linhas de B; C herda as linhas de A e as colunas de B.`,
      };

      // Comutatividade: B·A existe? É igual? (A é m×p, B é p×q, então B·A só existe se q = m e é p×p)
      let comut;
      if (q !== m) {
        comut = nota(`Aqui <i>B</i> · <i>A</i> nem está definido (B tem ${q} coluna${q > 1 ? "s" : ""} e A tem ${m} linha${m > 1 ? "s" : ""}). A ordem dos fatores importa!`, "alerta");
      } else if (m !== p) {
        comut = nota(`<i>B</i> · <i>A</i> existe, mas é ${p}×${p} enquanto <i>A</i> · <i>B</i> é ${m}×${q}: não podem ser iguais. O produto de matrizes <strong>não é comutativo</strong>.`, "alerta");
      } else {
        const BA = MT.multiplicar(B, A);
        comut = MT.iguais(BA, C)
          ? nota("Curiosidade: neste caso <i>A</i> · <i>B</i> = <i>B</i> · <i>A</i> — as matrizes <strong>comutam</strong>. Isso é exceção, não regra!", "curiosidade")
          : nota(`Calculando <i>B</i> · <i>A</i> obtemos outra matriz: <span class="rolagem-x inline">${matrizHTML(BA, { tam: "pequena" })}</span> ≠ <i>A</i> · <i>B</i>. O produto de matrizes <strong>não é comutativo</strong>.`, "alerta");
      }

      const passos =
        passosHTML([
          {
            t: "A regra: linha × coluna",
            c: `<p>Cada elemento <span class="var"><i>c</i><sub>ij</sub></span> é a linha <i>i</i> de <i>A</i> “vezes” a coluna <i>j</i> de <i>B</i>: multiplica-se termo a termo e soma-se.</p>
              ${eqHTML(ij("c"), op("="), sigmaHTML(p, "k=1"), `<span class="var"><i>a</i><sub>ik</sub></span>·<span class="var"><i>b</i><sub>kj</sub></span>`)}`,
          },
          {
            t: "Explore cada elemento",
            c: produtoInterativoHTML(A, B, C, { A: "<i>A</i>", B: "<i>B</i>", C: "<i>C</i>" }),
          },
        ]) + comut;

      return {
        titulo,
        regra,
        resultado: { tipo: "matriz", M: C, nome: "C" },
        passos,
        depois: (el) => ligarProduto($("[data-produto]", el), A, B, C, { a: "a", b: "b", c: "c", nomeA: "A", nomeB: "B", simbolico: true }),
      };
    },

    transposta: ({ A }) => {
      const [m, n] = [A.length, A[0].length];
      const T = MT.transpor(A);
      const titulo = `<i>A</i><sup>t</sup>`;
      const regra = { ok: true, html: `Definida para qualquer matriz: ${ord("<i>A</i>", m, n)} → ${ord("<i>A</i><sup>t</sup>", n, m)}` };
      let extra = nota("Propriedade: transpor duas vezes volta ao início, (<i>A</i><sup>t</sup>)<sup>t</sup> = <i>A</i>.");
      if (m === n && MT.iguais(A, T)) extra = nota("<i>A</i> = <i>A</i><sup>t</sup>: a matriz é <strong>simétrica</strong> (espelhada pela diagonal principal).", "curiosidade") + extra;
      else if (m === n && MT.iguais(MT.oposta(A), T)) extra = nota("<i>A</i><sup>t</sup> = −<i>A</i>: a matriz é <strong>antissimétrica</strong> (e a diagonal principal é toda nula).", "curiosidade") + extra;
      const passos = passosHTML([
        {
          t: "A regra",
          c: `<p>As <strong>linhas</strong> de <i>A</i> viram as <strong>colunas</strong> de <i>A</i><sup>t</sup>:</p>${eqHTML(`(<i>a</i><sup>t</sup>)<sub>ij</sub>`, op("="), `<span class="var"><i>a</i><sub>ji</sub></span>`)}`,
        },
        {
          t: "Cada linha vira coluna",
          c: `<div class="transp rolagem-x">${matrizHTML(A, { tam: "media", classe: (i) => `tinta tinta-${i % 6}` })}<span class="transp-seta" aria-hidden="true">⟶</span>${matrizHTML(T, { tam: "media", classe: (i, j) => `tinta tinta-${j % 6}` })}</div>
              <p class="legenda">A linha <i>i</i> de <i>A</i> (mesma cor) aparece como coluna <i>i</i> de <i>A</i><sup>t</sup>.</p>`,
        },
      ]);
      return { titulo, regra, resultado: { tipo: "matriz", M: T, nome: "A<sup>t</sup>" }, passos: passos + extra };
    },

    determinante: ({ A }) => {
      const n = A.length;
      const det = MT.determinante(A);
      const titulo = `det <i>A</i>`;
      const regra = { ok: true, html: `${ord("<i>A</i>", n, n)} é quadrada — o determinante só existe para matrizes quadradas` };
      const lista = [];
      let depois = null;

      if (n === 1) {
        lista.push({ t: "Ordem 1", c: `<p>O determinante de uma matriz 1×1 é o próprio elemento:</p>${eqHTML("det <i>A</i>", op("="), varHTML("a", 0, 0), op("="), numHTML(det))}` });
      } else if (n === 2) {
        const [[a, b], [c, d]] = A;
        const p = a.vezes(d);
        const s = b.vezes(c);
        lista.push({
          t: "Diagonal principal menos diagonal secundária",
          c: `<div class="det2">${matrizHTML(A, { tipo: "barras", tam: "media", classe: (i, j) => (i === j ? "diag-p" : "diag-s") })}</div>
              ${eqHTML("det <i>A</i>", op("="), `${varHTML("a", 0, 0)}·${varHTML("a", 1, 1)}`, op("−"), `${varHTML("a", 0, 1)}·${varHTML("a", 1, 0)}`)}`,
        });
        lista.push({
          t: "Substituindo os valores",
          c: contasHTML("det <i>A</i>", [
            `${numHTML(a, { par: true })}·${numHTML(d, { par: true })} ${op("−")} ${numHTML(b, { par: true })}·${numHTML(c, { par: true })}`,
            `${numHTML(p)} ${op("−")} ${numHTML(s, { par: true })}`,
            `<strong class="destaque-c">${numHTML(det)}</strong>`,
          ]),
        });
        lista.push({ t: "O que esse número significa", c: geometria2x2HTML(A, det) });
      } else if (n === 3) {
        const s = MT.sarrus(A);
        const termo = (d, tipo, k) => {
          const vars = d.celulas.map(([r, c]) => varHTML("a", r, c % 3)).join("·");
          const nums = d.valores.map((v) => numHTML(v, { par: true })).join("·");
          return `<li class="termo termo-${tipo}" data-diag-termo="${tipo}${k}"><span class="nw">${vars}</span> <span class="nw">${op("=")} ${nums}</span> <span class="nw">${op("=")} <strong>${numHTML(d.produto)}</strong></span></li>`;
        };
        lista.push({
          t: "Regra de Sarrus",
          c: `<p>Repetimos as duas primeiras colunas à direita. Os produtos das diagonais <b class="txt-a">principais</b> entram somando; os das <b class="txt-b">secundárias</b>, subtraindo.</p>
              <div class="rolagem-x">${sarrusHTML(A)}</div>`,
        });
        lista.push({
          t: "Diagonais principais",
          c: `<ul class="termos">${s.principais.map((d, k) => termo(d, "p", k)).join("")}</ul>${eqHTML("<i>P</i>", op("="), somaHTML(s.principais.map((d) => d.produto)), op("="), numHTML(s.P))}`,
        });
        lista.push({
          t: "Diagonais secundárias",
          c: `<ul class="termos">${s.secundarias.map((d, k) => termo(d, "s", k)).join("")}</ul>${eqHTML("<i>S</i>", op("="), somaHTML(s.secundarias.map((d) => d.produto)), op("="), numHTML(s.S))}`,
        });
        lista.push({
          t: "Determinante",
          c: contasHTML("det <i>A</i>", ["<i>P</i> − <i>S</i>", `${numHTML(s.P)} ${op("−")} ${numHTML(s.S, { par: true })}`, `<strong class="destaque-c">${numHTML(det)}</strong>`]),
        });
        depois = (el) => ligarSarrus(el, s);
      } else {
        const lp = MT.laplace(A);
        const nomeFila = `${lp.eixo} ${lp.indice + 1}`;
        const escolhida = (i, j) => (lp.eixo === "linha" ? i === lp.indice : j === lp.indice);
        lista.push({
          t: "Teorema de Laplace",
          c: `<p>Escolhemos a <strong>${nomeFila}</strong>${lp.zeros > 0 ? ` (a fila com mais zeros: ${lp.zeros})` : ""}. O determinante é a soma de cada elemento dela vezes o seu <strong>cofator</strong>:</p>
              ${eqHTML("det <i>A</i>", op("="), "Σ", `${ij("a")}·<span class="var"><i>A</i><sub>ij</sub></span>`)}
              ${eqHTML(`<span class="eq-texto">cofator:</span>`, `<span class="var"><i>A</i><sub>ij</sub></span>`, op("="), `(−1)<sup><i>i</i>+<i>j</i></sup>·<span class="var"><i>D</i><sub>ij</sub></span>`)}
              <p class="legenda"><span class="var"><i>D</i><sub>ij</sub></span> é o determinante da matriz que sobra ao eliminar a linha <i>i</i> e a coluna <i>j</i>.</p>
              <div class="rolagem-x">${matrizHTML(A, { tipo: "barras", tam: "media", classe: (i, j) => (escolhida(i, j) ? "realce" : "") })}</div>`,
        });
        const termosHTML = lp.termos
          .map((t) => {
            if (t.nulo) return `<li class="laplace-termo nulo">${varHTML("a", t.i, t.j)} = 0 → o termo se anula (não precisa calcular).</li>`;
            return `<li class="laplace-termo">
              <div class="rolagem-x">${eqHTML(
                varHTML("a", t.i, t.j),
                "·",
                `(−1)<sup>${t.i + 1}+${t.j + 1}</sup>`,
                "·",
                matrizHTML(t.menor, { tipo: "barras", tam: "pequena" })
              )}</div>
              ${contasHTML("", [`${numHTML(t.a, { par: true })} · (${t.sinal > 0 ? "+1" : "−1"}) · ${numHTML(t.detMenor, { par: true })}`, numHTML(t.produto)])}
            </li>`;
          })
          .join("");
        lista.push({ t: "Cada termo", c: `<ul class="laplace-termos">${termosHTML}</ul>` });
        const produtos = lp.termos.filter((t) => !t.nulo).map((t) => t.produto);
        lista.push({
          t: "Somando",
          c: contasHTML("det <i>A</i>", [produtos.length ? somaHTML(produtos) : numHTML(F.ZERO), `<strong class="destaque-c">${numHTML(det)}</strong>`]),
        });
      }

      let notas = "";
      MT.propriedadesDeterminante(A).forEach((p) => {
        if (p.tipo === "nula") notas += nota(`A ${p.nome} ${p.i + 1} é <strong>nula</strong> (só zeros) ⇒ det <i>A</i> = 0, sem fazer conta nenhuma.`, "curiosidade");
        if (p.tipo === "iguais") notas += nota(`As ${p.nome}s ${p.i + 1} e ${p.j + 1} são <strong>iguais</strong> ⇒ det <i>A</i> = 0.`, "curiosidade");
        if (p.tipo === "proporcionais")
          notas += nota(`${p.sigla}<sub>${p.j + 1}</sub> = ${numHTML(p.k, { par: true })}·${p.sigla}<sub>${p.i + 1}</sub>: filas <strong>proporcionais</strong> ⇒ det <i>A</i> = 0.`, "curiosidade");
        if (p.tipo === "triangular" || p.tipo === "diagonal") {
          const diag = Array.from({ length: n }, (_, i) => numHTML(A[i][i], { par: true })).join("·");
          notas += nota(`<i>A</i> é <strong>${p.tipo}</strong> ⇒ det <i>A</i> é o produto da diagonal principal: ${diag} = ${numHTML(det)}.`, "curiosidade");
        }
      });
      const conclusao = det.ehZero
        ? nota("Como det <i>A</i> = 0, a matriz é <strong>singular</strong>: não possui inversa.", "alerta")
        : nota("Como det <i>A</i> ≠ 0, a matriz é <strong>invertível</strong> (existe <i>A</i><sup>−1</sup>).", "ok");

      return { titulo, regra, resultado: { tipo: "numero", valor: det }, passos: notas + passosHTML(lista) + conclusao, depois };
    },

    inversa: ({ A }) => {
      const n = A.length;
      const det = MT.determinante(A);
      const titulo = `<i>A</i><sup>−1</sup>`;
      if (det.ehZero) {
        return {
          titulo,
          regra: { ok: false, html: `${ord("<i>A</i>", n, n)} é quadrada, mas det <i>A</i> = 0: a matriz é <strong>singular</strong>.` },
          resultado: {
            tipo: "mensagem",
            html: `<p class="res-msg-titulo">Não existe <i>A</i><sup>−1</sup></p><p>Quando det <i>A</i> = 0, nenhuma matriz <i>X</i> satisfaz <i>A</i> · <i>X</i> = <i>I</i>. Experimente mudar algum elemento.</p>`,
          },
          passos: nota("Uma matriz quadrada é invertível <strong>se, e somente se,</strong> seu determinante é diferente de zero.", "alerta"),
        };
      }
      const regra = { ok: true, html: `${ord("<i>A</i>", n, n)} é quadrada e det <i>A</i> = ${numHTML(det)} ≠ 0 → a inversa existe` };
      const lista = [
        {
          t: "A inversa existe?",
          c: `<p>Só existe <i>A</i><sup>−1</sup> se det <i>A</i> ≠ 0.</p>${eqHTML("det <i>A</i>", op("="), numHTML(det), op("≠"), "0", `<span class="ok-check">✓</span>`)}`,
        },
      ];
      let inv;
      if (n === 1) {
        inv = [[A[0][0].inverso()]];
        lista.push({ t: "Ordem 1", c: eqHTML("<i>A</i><sup>−1</sup>", op("="), `[ 1 / ${numHTML(A[0][0])} ]`, op("="), matrizHTML(inv, { cor: "c", tam: "media" })) });
      } else if (n === 2) {
        const [[a, b], [c, d]] = A;
        const adj = [
          [d, b.oposto()],
          [c.oposto(), a],
        ];
        inv = MT.escalar(det.inverso(), adj);
        lista.push({
          t: "Fórmula da 2×2",
          c: `<p>Troca-se a posição dos elementos da diagonal principal, troca-se o sinal dos da secundária e divide-se tudo pelo determinante:</p>
              ${eqHTML(
                "<i>A</i><sup>−1</sup>",
                op("="),
                `<span class="fr fr-grande"><span class="fr-n">1</span><span class="fr-d">det <i>A</i></span></span>`,
                "·",
                matrizHTML(
                  [
                    [0, 0],
                    [0, 0],
                  ],
                  { tam: "media", celula: (_, i, j) => [[varHTML("a", 1, 1), `−${varHTML("a", 0, 1)}`], [`−${varHTML("a", 1, 0)}`, varHTML("a", 0, 0)]][i][j] }
                )
              )}`,
        });
        lista.push({
          t: "Substituindo",
          c: `<div class="rolagem-x">${eqHTML("<i>A</i><sup>−1</sup>", op("="), numHTML(det.inverso(), { par: true }), "·", matrizHTML(adj, { tam: "media" }), op("="), matrizHTML(inv, { cor: "c", tam: "media" }))}</div>`,
        });
      } else {
        const gj = MT.gaussJordan(A);
        inv = gj.inversa;
        lista.push({ t: "Escalonamento de Gauss-Jordan", c: gaussJordanPassoHTML(gj, n) });
      }
      const I = MT.multiplicar(A, inv);
      lista.push({
        t: "Verificação",
        c: `<div class="rolagem-x">${eqHTML("<i>A</i> · <i>A</i><sup>−1</sup>", op("="), matrizHTML(I, { tam: "pequena" }), op("="), `<i>I</i>${sub(n)}`, MT.iguais(I, MT.identidade(n)) ? `<span class="ok-check">✓</span>` : "")}</div>`,
      });
      return { titulo, regra, resultado: { tipo: "matriz", M: inv, nome: "A<sup>−1</sup>" }, passos: passosHTML(lista) };
    },

    potencia: ({ A, n: e }) => {
      const n = A.length;
      const titulo = `<i>A</i><sup>${e}</sup>`;
      const regra = { ok: true, html: `${ord("<i>A</i>", n, n)} é quadrada — só assim <i>A</i> · <i>A</i> existe (colunas de A = linhas de A)` };
      if (e === 0) {
        const I = MT.identidade(n);
        return {
          titulo,
          regra,
          resultado: { tipo: "matriz", M: I, nome: `A<sup>0</sup>` },
          passos: passosHTML([{ t: "Por definição", c: `<p>Para toda matriz quadrada, <i>A</i><sup>0</sup> é a identidade de mesma ordem:</p>${eqHTML("<i>A</i><sup>0</sup>", op("="), `<i>I</i>${sub(n)}`, op("="), matrizHTML(I, { cor: "c", tam: "media" }))}` }]),
        };
      }
      const lista = MT.potencias(A, e);
      const R = lista[lista.length - 1];
      const itens = lista
        .map((P, k) => {
          const exp = k + 1;
          const rotulo = exp === 1 ? "<i>A</i><sup>1</sup> = <i>A</i>" : `<i>A</i><sup>${exp}</sup> = <i>A</i>${exp - 1 > 1 ? `<sup>${exp - 1}</sup>` : ""} · <i>A</i>`;
          return `<div class="pot-item${exp === e ? " final" : ""}"><span class="pot-rotulo">${rotulo}</span>${matrizHTML(P, { tam: "pequena", cor: exp === e ? "c" : "" })}</div>`;
        })
        .join("");
      let extra = "";
      const fib = [["1", "1"], ["1", "0"]].map((l) => l.map((x) => F.ler(x)));
      if (n === 2 && MT.iguais(A, fib)) {
        extra = nota(
          `Curiosidade: as potências de <span class="rolagem-x inline">${matrizHTML(fib, { tam: "pequena" })}</span> geram a <strong>sequência de Fibonacci</strong> (1, 1, 2, 3, 5, 8, 13…): <i>A</i><sup>n</sup> tem <i>F</i><sub>n+1</sub>, <i>F</i><sub>n</sub> e <i>F</i><sub>n−1</sub> como elementos.`,
          "curiosidade"
        );
      } else if (A.every((l, i) => l.every((v, j) => i === j || v.ehZero))) {
        extra = nota("<i>A</i> é <strong>diagonal</strong>: basta elevar cada elemento da diagonal ao expoente.", "curiosidade");
      }
      return {
        titulo,
        regra,
        resultado: { tipo: "matriz", M: R, nome: `A<sup>${e}</sup>` },
        passos: passosHTML([
          { t: "A regra", c: `<p>Multiplica-se <i>A</i> por ela mesma ${e} ${e === 1 ? "vez" : "vezes"}, uma potência de cada vez:</p>${eqHTML(`<i>A</i><sup>${e}</sup>`, op("="), "<i>A</i> · <i>A</i> · … · <i>A</i>", `<span class="eq-texto">(${e} fator${e > 1 ? "es" : ""})</span>`)}` },
          { t: "Potência por potência", c: `<div class="pot-lista">${itens}</div>` },
        ]) + extra,
      };
    },

    divisao: ({ A, B }) => {
      const [m, p] = [A.length, A[0].length];
      const q = B.length;
      const titulo = `<i>X</i> ${op("=")} <i>A</i> · <i>B</i><sup>−1</sup>`;
      const aviso = nota(
        "<strong>Não existe divisão de matrizes.</strong> Quando se fala em “dividir <i>A</i> por <i>B</i>”, o que se faz é multiplicar <i>A</i> pela <strong>inversa</strong> de <i>B</i>: <i>X</i> = <i>A</i> · <i>B</i><sup>−1</sup>, a matriz que resolve <i>X</i> · <i>B</i> = <i>A</i>. Atenção: em geral <i>A</i> · <i>B</i><sup>−1</sup> ≠ <i>B</i><sup>−1</sup> · <i>A</i>.",
        "alerta"
      );
      if (p !== q) {
        return {
          titulo,
          regra: {
            ok: false,
            html: `${ord("<i>A</i>", m, p, { realcarN: "dim-falha" })} · ${ord("<i>B</i><sup>−1</sup>", q, q, { realcarM: "dim-falha" })} — para multiplicar, o nº de colunas de A (${p}) precisa ser igual à ordem de B (${q}).`,
            conserto: {
              rotulo: `Ajustar B para ${p} × ${p}`,
              acao: () => {
                estado.B.m = p;
                estado.B.n = p;
              },
            },
          },
          resultado: null,
          passos: aviso,
        };
      }
      const detB = MT.determinante(B);
      if (detB.ehZero) {
        return {
          titulo,
          regra: { ok: false, html: `det <i>B</i> = 0: <i>B</i> é singular, então <i>B</i><sup>−1</sup> não existe.` },
          resultado: { tipo: "mensagem", html: `<p class="res-msg-titulo">Não existe <i>B</i><sup>−1</sup></p><p>Sem a inversa de <i>B</i>, não há como “dividir” por <i>B</i>. Mude algum elemento de <i>B</i>.</p>` },
          passos: aviso,
        };
      }
      const invB = MT.inversa(B);
      const X = MT.multiplicar(A, invB);
      const regra = {
        ok: true,
        html: `${ord("<i>A</i>", m, p, { realcarN: "dim-ok" })} · ${ord("<i>B</i><sup>−1</sup>", q, q, { realcarM: "dim-ok" })} = ${ord("<i>X</i>", m, q)} e det <i>B</i> = ${numHTML(detB)} ≠ 0`,
      };
      const verif = MT.multiplicar(X, B);
      const passos =
        aviso +
        passosHTML([
          { t: "B é invertível?", c: eqHTML("det <i>B</i>", op("="), numHTML(detB), op("≠"), "0", `<span class="ok-check">✓</span>`) },
          {
            t: "Calcular B⁻¹",
            c: `<div class="rolagem-x">${eqHTML("<i>B</i><sup>−1</sup>", op("="), matrizHTML(invB, { cor: "b", tam: "media" }))}</div>
                <p class="legenda">Veja a operação <strong>Inversa</strong> para o passo a passo ${q === 2 ? "da fórmula 2×2" : "do escalonamento de Gauss-Jordan"}.</p>`,
          },
          { t: "Multiplicar A · B⁻¹", c: produtoInterativoHTML(A, invB, X, { A: "<i>A</i>", B: "<i>B</i><sup>−1</sup>", C: "<i>X</i>" }) },
          {
            t: "Verificação",
            c: `<div class="rolagem-x">${eqHTML("<i>X</i> · <i>B</i>", op("="), matrizHTML(verif, { tam: "pequena" }), op("="), "<i>A</i>", MT.iguais(verif, A) ? `<span class="ok-check">✓</span>` : "")}</div>`,
          },
        ]);
      return {
        titulo,
        regra,
        resultado: { tipo: "matriz", M: X, nome: "X" },
        passos,
        depois: (el) => ligarProduto($("[data-produto]", el), A, invB, X, { a: "a", b: "b", c: "x", nomeA: "A", nomeB: "B⁻¹", simbolico: false }),
      };
    },
  };

  // =====================================================================
  // Leitura, cálculo e exibição
  // =====================================================================

  const regraEl = $("#regra");
  const resCorpo = $("#res-corpo");
  const resAcoes = $("#res-acoes");
  const passosCorpo = $("#passos-corpo");
  const resultadoEl = $("#resultado");
  let ultimo = null;
  let redesenhos = [];
  let temporizador = 0;

  function lerMatriz(nome) {
    const s = estado[nome];
    const erros = [];
    const M = MT.criar(s.m, s.n, (i, j) => {
      try {
        return F.ler(s.v[i][j]);
      } catch (e) {
        erros.push({ nome, i, j, texto: s.v[i][j], msg: e.message });
        return F.ZERO;
      }
    });
    return { M, erros };
  }

  function agendarCalculo() {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => calcular(), 140);
  }

  function calcular({ animar = false } = {}) {
    clearTimeout(temporizador);
    const opAtual = opPorId[estado.op];
    const a = lerMatriz("A");
    const b = opAtual.usaB ? lerMatriz("B") : { M: null, erros: [] };
    const erros = [...a.erros, ...b.erros];
    let k = null;
    if (opAtual.usaK) {
      try {
        k = F.ler(estado.k);
      } catch (e) {
        erros.push({ nome: "k", texto: estado.k, msg: e.message });
      }
    }

    let r;
    if (erros.length) {
      r = resultadoErroEntrada(erros);
    } else {
      try {
        r = CALCULOS[opAtual.id]({ A: a.M, B: b.M, k, n: estado.n });
      } catch (e) {
        r = { titulo: "", regra: null, resultado: { tipo: "mensagem", html: `<p class="res-msg-titulo">Algo deu errado</p><p>${escaparHTML(e.message)}</p>` }, passos: "" };
      }
    }
    ultimo = r;
    renderResultado(r, animar);
  }

  function resultadoErroEntrada(erros) {
    const itens = erros
      .slice(0, 6)
      .map((e) => {
        const onde = e.nome === "k" ? "<i>k</i>" : varHTML(e.nome.toLowerCase(), e.i, e.j) + ` <span class="eq-texto">de ${e.nome}</span>`;
        return `<li>${onde}: “${escaparHTML(e.texto)}” — ${e.msg}</li>`;
      })
      .join("");
    return {
      titulo: "",
      regra: null,
      resultado: { tipo: "mensagem", erro: true, html: `<p class="res-msg-titulo">Confira os valores destacados</p><ul class="lista-erros">${itens}</ul>` },
      passos: nota("Formatos aceitos: inteiros (−3), decimais com vírgula ou ponto (1,5) e frações (3/4 ou −1/2). Campo vazio vale 0."),
    };
  }

  function renderResultado(r, animar) {
    redesenhos = [];

    // Regra da operação (dimensões compatíveis?)
    if (r.regra) {
      regraEl.hidden = false;
      regraEl.className = `regra ${r.regra.ok ? "ok" : "falha"}`;
      regraEl.innerHTML = `<span class="regra-icone" aria-hidden="true">${r.regra.ok ? "✓" : "✕"}</span><div class="regra-txt">${r.regra.html}</div>`;
      if (r.regra.conserto) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-conserto";
        btn.textContent = r.regra.conserto.rotulo;
        btn.addEventListener("click", () => {
          r.regra.conserto.acao();
          estado.exemploIntocado = false;
          aplicarRestricoes();
          atualizarUI();
          renderGrade("A");
          renderGrade("B");
          calcular({ animar: true });
        });
        regraEl.appendChild(btn);
      }
    } else {
      regraEl.hidden = true;
      regraEl.innerHTML = "";
    }

    // Resultado principal
    const res = r.resultado;
    const formato = estado.formato;
    resAcoes.hidden = !res || res.tipo === "mensagem";
    $("#usar-como-a").hidden = !res || res.tipo !== "matriz";

    if (!res) {
      resCorpo.innerHTML = `<div class="res-vazio"><p class="res-msg-titulo">Operação não definida</p><p>Ajuste as ordens das matrizes conforme a regra acima.</p></div>`;
    } else if (res.tipo === "matriz") {
      const cols = res.M[0].length;
      resCorpo.innerHTML = `
        <div class="res-eq rolagem-x">
          <span class="res-titulo">${r.titulo} ${op("=")}</span>
          ${matrizHTML(res.M, {
            cor: "c",
            tam: "grande",
            formato,
            classe: animar && !reduzirMovimento ? () => "pop" : null,
            attrs: animar && !reduzirMovimento ? (i, j) => `style="--d:${(i * cols + j) * 32}ms"` : null,
          })}
        </div>`;
    } else if (res.tipo === "numero") {
      resCorpo.innerHTML = `
        <div class="res-eq">
          <span class="res-titulo">${r.titulo} ${op("=")}</span>
          <span class="res-numero${animar && !reduzirMovimento ? " pop" : ""}">${numHTML(res.valor, { formato })}</span>
        </div>`;
    } else {
      resCorpo.innerHTML = `<div class="res-mensagem${res.erro ? " erro" : ""}">${res.html}</div>`;
    }

    if (animar && !reduzirMovimento) {
      resultadoEl.classList.remove("piscar");
      void resultadoEl.offsetWidth;
      resultadoEl.classList.add("piscar");
    }

    // Passo a passo
    passosCorpo.innerHTML = r.passos || `<p class="passos-vazio">O passo a passo aparece aqui quando a operação estiver definida.</p>`;
    passosCorpo.classList.toggle("animar", animar && !reduzirMovimento);
    if (r.depois) r.depois(passosCorpo);
  }

  window.addEventListener("resize", () => redesenhos.forEach((fn) => fn()));

  function rolarParaResultado() {
    if (window.innerWidth >= 1000) return;
    resultadoEl.scrollIntoView({ behavior: reduzirMovimento ? "auto" : "smooth", block: "start" });
  }

  // =====================================================================
  // Interface geral
  // =====================================================================

  function renderOps() {
    opsEl.innerHTML = OPS.map(
      (o) => `<button type="button" class="op" data-op="${o.id}" aria-pressed="false">
        <span class="op-expr">${o.expr}</span>
        <span class="op-nome">${o.nome}</span>
      </button>`
    ).join("");
  }

  function atualizarUI() {
    const opAtual = opPorId[estado.op];
    $$(".op", opsEl).forEach((b) => {
      const ativo = b.dataset.op === estado.op;
      b.classList.toggle("ativo", ativo);
      b.setAttribute("aria-pressed", ativo ? "true" : "false");
    });
    editores.B.el.hidden = !opAtual.usaB;
    campoK.hidden = !opAtual.usaK;
    campoN.hidden = !opAtual.usaN;
    trocarBtn.disabled = !opAtual.usaB;
    valorN.textContent = estado.n;
    $('[data-stepper="potencia"] [data-delta="-1"]').disabled = estado.n <= 0;
    $('[data-stepper="potencia"] [data-delta="1"]').disabled = estado.n >= N_MAX;
    atualizarSteppers("A");
    atualizarSteppers("B");
  }

  function selecionarOp(id) {
    if (estado.op === id) return;
    estado.op = id;
    if (estado.exemploIntocado) carregarExemplo(id);
    aplicarRestricoes();
    atualizarUI();
    renderGrade("A");
    renderGrade("B");
    calcular({ animar: true });
  }

  opsEl.addEventListener("click", (e) => {
    const b = e.target.closest(".op");
    if (b) selecionarOp(b.dataset.op);
  });

  $("#carregar-exemplo").addEventListener("click", () => {
    carregarExemplo(estado.op);
    aplicarRestricoes();
    atualizarUI();
    renderGrade("A");
    renderGrade("B");
    calcular({ animar: true });
  });

  trocarBtn.addEventListener("click", () => {
    [estado.A, estado.B] = [estado.B, estado.A];
    estado.exemploIntocado = false;
    aplicarRestricoes();
    atualizarUI();
    renderGrade("A");
    renderGrade("B");
    calcular({ animar: true });
  });

  entradaK.addEventListener("input", () => {
    estado.k = entradaK.value;
    estado.exemploIntocado = false;
    validarCampo(entradaK, entradaK.value);
    agendarCalculo();
  });

  campoN.addEventListener("click", (e) => {
    const b = e.target.closest("[data-delta]");
    if (!b) return;
    estado.n = Math.max(0, Math.min(N_MAX, estado.n + Number(b.dataset.delta)));
    estado.exemploIntocado = false;
    atualizarUI();
    calcular({ animar: true });
  });

  $$(".seg-btn").forEach((b) =>
    b.addEventListener("click", () => {
      estado.formato = b.dataset.formato;
      $$(".seg-btn").forEach((x) => {
        x.classList.toggle("ativo", x === b);
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      calcular();
    })
  );

  $("#calcular").addEventListener("click", () => {
    calcular({ animar: true });
    rolarParaResultado();
  });

  function avisarNoBotao(btn, texto) {
    const span = $("span", btn);
    const original = span.dataset.original || span.textContent;
    span.dataset.original = original;
    span.textContent = texto;
    btn.classList.add("feito");
    setTimeout(() => {
      span.textContent = original;
      btn.classList.remove("feito");
    }, 1600);
  }

  $("#copiar").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const res = ultimo && ultimo.resultado;
    if (!res || res.tipo === "mensagem") return;
    const valor = (v) => (estado.formato === "decimal" ? v.decimal(4).texto.replace("−", "-") : v.paraTexto());
    const texto = res.tipo === "numero" ? valor(res.valor) : res.M.map((l) => l.map(valor).join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      avisarNoBotao(btn, "Copiado!");
    } catch (err) {
      const area = document.createElement("textarea");
      area.value = texto;
      area.setAttribute("readonly", "");
      area.style.position = "absolute";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e2) {
        ok = false;
      }
      area.remove();
      avisarNoBotao(btn, ok ? "Copiado!" : "Não deu para copiar");
    }
  });

  $("#usar-como-a").addEventListener("click", (e) => {
    const res = ultimo && ultimo.resultado;
    if (!res || res.tipo !== "matriz") return;
    const s = estado.A;
    s.m = res.M.length;
    s.n = res.M[0].length;
    s.v = vazia();
    res.M.forEach((l, i) => l.forEach((v, j) => (s.v[i][j] = v.paraTexto())));
    estado.exemploIntocado = false;
    // Se a operação exige A quadrada e o resultado não é, vai para o produto.
    if (opPorId[estado.op].quadA && s.m !== s.n) estado.op = "produto";
    aplicarRestricoes();
    atualizarUI();
    renderGrade("A");
    calcular({ animar: true });
    avisarNoBotao(e.currentTarget, "Agora é a matriz A");
    editores.A.el.scrollIntoView({ behavior: reduzirMovimento ? "auto" : "smooth", block: "nearest" });
  });

  document.addEventListener("keydown", (e) => {
    if (!app.hidden && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      calcular({ animar: true });
      rolarParaResultado();
    }
  });

  // =====================================================================
  // Abertura ⇄ aplicativo
  // =====================================================================

  let appAberto = false;

  function mostrarApp(animar) {
    intro.hidden = true;
    palco.parar();
    app.hidden = false;
    window.scrollTo(0, 0);
    calcular({ animar });
    const revelar = () => $$(".reveal", app).forEach((el) => el.classList.add("visivel"));
    if (animar) requestAnimationFrame(() => requestAnimationFrame(revelar));
    else revelar();
  }

  function abrirApp() {
    if (appAberto) return;
    appAberto = true;
    if (reduzirMovimento) {
      mostrarApp(false);
      return;
    }
    intro.classList.add("saindo");
    setTimeout(() => mostrarApp(true), 420);
  }

  function voltarIntro() {
    appAberto = false;
    app.hidden = true;
    $$(".reveal", app).forEach((el) => el.classList.remove("visivel"));
    intro.classList.remove("saindo");
    intro.hidden = false;
    window.scrollTo(0, 0);
    palco.iniciar();
  }

  $("#abrir-app").addEventListener("click", abrirApp);
  $("#voltar-intro").addEventListener("click", voltarIntro);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !appAberto && !intro.hidden) abrirApp();
  });

  // =====================================================================
  // Início
  // =====================================================================

  const editorA = criarEditor("A");
  const editorB = criarEditor("B");
  colEntrada.insertBefore(editorA.el, campoK);
  colEntrada.insertBefore(editorB.el, campoK);

  renderOps();
  carregarExemplo(estado.op);
  aplicarRestricoes();
  atualizarUI();
  renderGrade("A");
  renderGrade("B");

  $$(".reveal", app).forEach((el, i) => el.style.setProperty("--atraso", `${i * 70}ms`));

  if (location.hash === "#app") {
    appAberto = true;
    mostrarApp(false);
  } else {
    palco.iniciar();
  }
})();
