(() => {
  const temaToggleBtn = document.getElementById("tema-toggle");

  function temaPreferido() {
    const salvo = localStorage.getItem("tema");
    if (salvo === "dark" || salvo === "light") return salvo;
    return "dark";
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute("data-theme", tema);
    temaToggleBtn.textContent = tema === "dark" ? "☀️" : "🌙";
    temaToggleBtn.setAttribute("aria-label", tema === "dark" ? "Ativar modo claro" : "Ativar modo escuro");
  }

  let temaAtual = temaPreferido();
  aplicarTema(temaAtual);

  temaToggleBtn.addEventListener("click", () => {
    temaAtual = temaAtual === "dark" ? "light" : "dark";
    localStorage.setItem("tema", temaAtual);
    aplicarTema(temaAtual);
  });

  // --- Animação no card do professor: flutua sozinha e reage ao mouse/toque ---
  const professorCard = document.querySelector(".professor-card");

  if (professorCard) {
    const simbolos = Array.from(professorCard.querySelectorAll(".mx"));
    const foto = professorCard.querySelector(".professor-foto");

    let pointerX = 0;
    let pointerY = 0;
    const inicio = performance.now();

    function quadro(agora) {
      const t = (agora - inicio) / 1000;

      simbolos.forEach((el, i) => {
        const fase = i * 0.9;
        const idleX = Math.sin(t * 0.6 + fase) * 5;
        const idleY = Math.cos(t * 0.5 + fase) * 5;
        const intensidadePointer = 10 + (i % 4) * 6;
        const dx = idleX + pointerX * intensidadePointer;
        const dy = idleY + pointerY * intensidadePointer;
        el.style.setProperty("--dx", `${dx.toFixed(1)}px`);
        el.style.setProperty("--dy", `${dy.toFixed(1)}px`);
      });

      if (foto) {
        const idleTilt = Math.sin(t * 0.4) * 1.6;
        foto.style.setProperty("--tilt", `${(idleTilt + pointerX * 5).toFixed(2)}deg`);
        foto.style.setProperty("--zoom", pointerX !== 0 || pointerY !== 0 ? "1.03" : "1");
      }

      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);

    function atualizarPonteiro(clientX, clientY) {
      const rect = professorCard.getBoundingClientRect();
      pointerX = (clientX - rect.left) / rect.width - 0.5;
      pointerY = (clientY - rect.top) / rect.height - 0.5;
    }

    function soltarPonteiro() {
      pointerX = 0;
      pointerY = 0;
    }

    professorCard.addEventListener("pointermove", (e) => atualizarPonteiro(e.clientX, e.clientY));
    professorCard.addEventListener("pointerleave", soltarPonteiro);
    professorCard.addEventListener("pointerup", soltarPonteiro);
    professorCard.addEventListener("pointercancel", soltarPonteiro);
  }

  const operacaoSelect = document.getElementById("operacao");
  const modoOperandoField = document.getElementById("modo-operando-field");
  const modoOperandoGroup = document.getElementById("modo-operando");
  const toggleButtons = modoOperandoGroup.querySelectorAll(".toggle-btn");

  const aLinhasStepper = document.getElementById("a-linhas-stepper");
  const aLinhasLabel = document.getElementById("a-linhas-label");
  const aColunasStepper = document.getElementById("a-colunas-stepper");
  const aLinhasValorEl = document.getElementById("a-linhas-valor");
  const aColunasValorEl = document.getElementById("a-colunas-valor");
  const bLinhasValorEl = document.getElementById("b-linhas-valor");
  const bColunasValorEl = document.getElementById("b-colunas-valor");

  const escalarField = document.getElementById("escalar-field");
  const escalarLabel = document.getElementById("escalar-label");
  const escalarInput = document.getElementById("escalar");

  const calcularBtn = document.getElementById("calcular-btn");

  const matrizBBloco = document.getElementById("matriz-b-bloco");
  const matrizAContainer = document.getElementById("matriz-a");
  const matrizBContainer = document.getElementById("matriz-b");

  const resultadoSection = document.getElementById("resultado-section");
  const resultadoConteudo = document.getElementById("resultado-conteudo");

  let modoAtual = "matriz";

  const DIM_MIN = 1;
  const DIM_MAX = 8;

  const dims = { aLinhas: 3, aColunas: 3, bLinhas: 3, bColunas: 3 };
  const DIM_KEYS = {
    "a-linhas": "aLinhas",
    "a-colunas": "aColunas",
    "b-linhas": "bLinhas",
    "b-colunas": "bColunas",
  };

  function clampDim(valor) {
    return Math.min(DIM_MAX, Math.max(DIM_MIN, valor));
  }

  function ehDeterminante() {
    return operacaoSelect.value === "determinante";
  }

  function usaMatrizB(op, modo) {
    if (op === "soma" || op === "subtracao") return true;
    if (op === "multiplicacao" || op === "divisao") return modo === "matriz";
    return false;
  }

  function usaEscalar(op, modo) {
    return (op === "multiplicacao" || op === "divisao") && modo === "escalar";
  }

  // --- Navegação por teclado dentro da grade (estilo planilha) ---

  function habilitarNavegacaoTeclado(container) {
    container.addEventListener("keydown", (e) => {
      if (!(e.target instanceof HTMLInputElement)) return;
      const row = parseInt(e.target.dataset.row, 10);
      const col = parseInt(e.target.dataset.col, 10);
      let novoRow = row;
      let novoCol = col;
      if (e.key === "ArrowUp") novoRow = row - 1;
      else if (e.key === "ArrowDown" || e.key === "Enter") novoRow = row + 1;
      else if (e.key === "ArrowLeft") novoCol = col - 1;
      else if (e.key === "ArrowRight") novoCol = col + 1;
      else return;

      const proximo = container.querySelector(
        `input[data-row="${novoRow}"][data-col="${novoCol}"]`
      );
      if (proximo) {
        e.preventDefault();
        proximo.focus();
      }
    });

    container.addEventListener(
      "focus",
      (e) => {
        if (e.target instanceof HTMLInputElement) e.target.select();
      },
      true
    );
  }

  habilitarNavegacaoTeclado(matrizAContainer);
  habilitarNavegacaoTeclado(matrizBContainer);

  function regenerarGrade(container, linhas, colunas, prefixo) {
    const valoresAntigos = {};
    container.querySelectorAll("input").forEach((input) => {
      valoresAntigos[`${input.dataset.row}-${input.dataset.col}`] = input.value;
    });

    container.innerHTML = "";
    container.style.setProperty("--cols", colunas);

    for (let i = 0; i < linhas; i++) {
      for (let j = 0; j < colunas; j++) {
        const input = document.createElement("input");
        input.type = "number";
        input.step = "any";
        input.inputMode = "decimal";
        const chave = `${i}-${j}`;
        input.value = valoresAntigos[chave] !== undefined ? valoresAntigos[chave] : "0";
        input.dataset.row = String(i);
        input.dataset.col = String(j);
        input.setAttribute("aria-label", `${prefixo} linha ${i + 1} coluna ${j + 1}`);
        container.appendChild(input);
      }
    }
  }

  function atualizarValoresSteppers() {
    aLinhasValorEl.textContent = dims.aLinhas;
    aColunasValorEl.textContent = dims.aColunas;
    bLinhasValorEl.textContent = dims.bLinhas;
    bColunasValorEl.textContent = dims.bColunas;
  }

  function atualizarTudo() {
    const op = operacaoSelect.value;
    const determinanteAtivo = ehDeterminante();

    modoOperandoField.hidden = !(op === "multiplicacao" || op === "divisao");
    escalarField.hidden = !usaEscalar(op, modoAtual);
    escalarLabel.textContent = op === "divisao" ? "Dividir por (escalar)" : "Multiplicar por (escalar)";

    aColunasStepper.hidden = determinanteAtivo;
    aLinhasLabel.textContent = determinanteAtivo ? "Ordem da matriz (N × N)" : "Linhas";
    if (determinanteAtivo) dims.aColunas = dims.aLinhas;

    const precisaB = usaMatrizB(op, modoAtual);
    matrizBBloco.hidden = !precisaB;

    atualizarValoresSteppers();
    regenerarGrade(matrizAContainer, dims.aLinhas, dims.aColunas, "A,");
    if (precisaB) {
      regenerarGrade(matrizBContainer, dims.bLinhas, dims.bColunas, "B,");
    }

    resultadoSection.hidden = true;
  }

  document.querySelectorAll(".stepper-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const propriedade = DIM_KEYS[btn.dataset.stepper];
      const delta = parseInt(btn.dataset.delta, 10);
      dims[propriedade] = clampDim(dims[propriedade] + delta);
      atualizarTudo();
    });
  });

  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      modoAtual = btn.dataset.modo;
      atualizarTudo();
    });
  });

  operacaoSelect.addEventListener("change", atualizarTudo);

  function lerMatriz(container, linhas, colunas) {
    const matriz = Array.from({ length: linhas }, () => Array(colunas).fill(0));
    container.querySelectorAll("input").forEach((input) => {
      const i = parseInt(input.dataset.row, 10);
      const j = parseInt(input.dataset.col, 10);
      const val = parseFloat(input.value);
      matriz[i][j] = Number.isFinite(val) ? val : 0;
    });
    return matriz;
  }

  // --- Operações matriciais ---

  function somar(A, B) {
    if (A.length !== B.length || A[0].length !== B[0].length) {
      throw new Error("Para somar, as duas matrizes precisam ter a mesma quantidade de linhas e colunas.");
    }
    return A.map((linha, i) => linha.map((v, j) => v + B[i][j]));
  }

  function subtrair(A, B) {
    if (A.length !== B.length || A[0].length !== B[0].length) {
      throw new Error("Para subtrair, as duas matrizes precisam ter a mesma quantidade de linhas e colunas.");
    }
    return A.map((linha, i) => linha.map((v, j) => v - B[i][j]));
  }

  function multiplicarMatrizes(A, B) {
    const n = A.length;
    const m = A[0].length;
    const p = B[0].length;
    if (B.length !== m) {
      throw new Error("Para multiplicar A × B, o número de colunas de A precisa ser igual ao número de linhas de B.");
    }
    const resultado = Array.from({ length: n }, () => Array(p).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) {
        let soma = 0;
        for (let k = 0; k < m; k++) soma += A[i][k] * B[k][j];
        resultado[i][j] = soma;
      }
    }
    return resultado;
  }

  function multiplicarEscalar(A, k) {
    return A.map((linha) => linha.map((v) => v * k));
  }

  function dividirEscalar(A, k) {
    if (k === 0) throw new Error("Não é possível dividir por zero.");
    return A.map((linha) => linha.map((v) => v / k));
  }

  function determinante(M) {
    const n = M.length;
    if (M.some((linha) => linha.length !== n)) {
      throw new Error("O determinante só existe para matrizes quadradas (mesmo número de linhas e colunas).");
    }
    const mat = M.map((linha) => linha.slice());
    let det = 1;

    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      let maxVal = Math.abs(mat[col][col]);
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(mat[r][col]) > maxVal) {
          maxVal = Math.abs(mat[r][col]);
          pivotRow = r;
        }
      }
      if (maxVal < 1e-12) return 0;
      if (pivotRow !== col) {
        [mat[col], mat[pivotRow]] = [mat[pivotRow], mat[col]];
        det *= -1;
      }
      det *= mat[col][col];
      for (let r = col + 1; r < n; r++) {
        const fator = mat[r][col] / mat[col][col];
        for (let c = col; c < n; c++) {
          mat[r][c] -= fator * mat[col][c];
        }
      }
    }
    return arredondar(det);
  }

  function inversa(M) {
    const n = M.length;
    if (M.some((linha) => linha.length !== n)) {
      throw new Error("Só é possível inverter uma matriz quadrada.");
    }
    if (Math.abs(determinante(M)) < 1e-9) {
      throw new Error("Essa matriz não é invertível (determinante igual a zero).");
    }
    const aug = M.map((linha, i) => [
      ...linha,
      ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    ]);

    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      let maxVal = Math.abs(aug[col][col]);
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(aug[r][col]) > maxVal) {
          maxVal = Math.abs(aug[r][col]);
          pivotRow = r;
        }
      }
      if (pivotRow !== col) [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];

      const pivot = aug[col][col];
      for (let c = 0; c < 2 * n; c++) aug[col][c] /= pivot;

      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const fator = aug[r][col];
        for (let c = 0; c < 2 * n; c++) aug[r][c] -= fator * aug[col][c];
      }
    }

    return aug.map((linha) => linha.slice(n));
  }

  function dividirPorMatriz(A, B) {
    if (B.length !== B[0].length) {
      throw new Error("Para dividir por uma matriz (A ÷ B = A × B⁻¹), B precisa ser quadrada.");
    }
    const invB = inversa(B);
    return multiplicarMatrizes(A, invB);
  }

  function arredondar(v) {
    return Math.round((v + Number.EPSILON) * 10000) / 10000;
  }

  function formatarNumero(v) {
    return arredondar(v).toString().replace(".", ",");
  }

  // --- Render ---

  function mostrarResultadoMatriz(matriz) {
    resultadoConteudo.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "matriz-wrap";

    const bracketEsq = document.createElement("div");
    bracketEsq.className = "matriz-bracket matriz-bracket-left";
    const bracketDir = document.createElement("div");
    bracketDir.className = "matriz-bracket matriz-bracket-right";

    const grid = document.createElement("div");
    grid.className = "matriz-grid resultado-grid";
    grid.style.setProperty("--cols", matriz[0].length);
    matriz.forEach((linha) => {
      linha.forEach((v) => {
        const cel = document.createElement("div");
        cel.className = "resultado-celula";
        cel.textContent = formatarNumero(v);
        grid.appendChild(cel);
      });
    });

    wrap.appendChild(bracketEsq);
    wrap.appendChild(grid);
    wrap.appendChild(bracketDir);
    resultadoConteudo.appendChild(wrap);
    resultadoSection.hidden = false;
    resultadoSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function mostrarResultadoEscalar(valor) {
    resultadoConteudo.innerHTML = `<p class="resultado-escalar">${formatarNumero(valor)}</p>`;
    resultadoSection.hidden = false;
    resultadoSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function mostrarErro(mensagem) {
    resultadoConteudo.innerHTML = `<p class="erro-msg">${mensagem}</p>`;
    resultadoSection.hidden = false;
    resultadoSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  calcularBtn.addEventListener("click", () => {
    const op = operacaoSelect.value;
    try {
      const A = lerMatriz(matrizAContainer, dims.aLinhas, dims.aColunas);

      if (op === "determinante") {
        mostrarResultadoEscalar(determinante(A));
        return;
      }

      if (op === "soma" || op === "subtracao") {
        const B = lerMatriz(matrizBContainer, dims.bLinhas, dims.bColunas);
        mostrarResultadoMatriz(op === "soma" ? somar(A, B) : subtrair(A, B));
        return;
      }

      if (op === "multiplicacao") {
        if (modoAtual === "escalar") {
          const k = parseFloat(escalarInput.value);
          mostrarResultadoMatriz(multiplicarEscalar(A, Number.isFinite(k) ? k : 0));
        } else {
          const B = lerMatriz(matrizBContainer, dims.bLinhas, dims.bColunas);
          mostrarResultadoMatriz(multiplicarMatrizes(A, B));
        }
        return;
      }

      if (op === "divisao") {
        if (modoAtual === "escalar") {
          const k = parseFloat(escalarInput.value);
          mostrarResultadoMatriz(dividirEscalar(A, Number.isFinite(k) ? k : 0));
        } else {
          const B = lerMatriz(matrizBContainer, dims.bLinhas, dims.bColunas);
          mostrarResultadoMatriz(dividirPorMatriz(A, B));
        }
        return;
      }
    } catch (erro) {
      mostrarErro(erro.message);
    }
  });

  atualizarTudo();
})();
