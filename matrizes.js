/* Álgebra de matrizes com frações exatas.
   Além do resultado, as funções devolvem os dados de cada etapa
   (diagonais de Sarrus, termos de Laplace, operações de Gauss-Jordan)
   para a interface montar o passo a passo. */
(function () {
  "use strict";

  const F = window.Fracao;
  const ZERO = F.ZERO;
  const UM = F.UM;

  function criar(m, n, fn) {
    return Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => fn(i, j)));
  }

  function identidade(n) {
    return criar(n, n, (i, j) => (i === j ? UM : ZERO));
  }

  function copiar(M) {
    return M.map((linha) => linha.slice());
  }

  function iguais(A, B) {
    return (
      A.length === B.length &&
      A[0].length === B[0].length &&
      A.every((linha, i) => linha.every((v, j) => v.igual(B[i][j])))
    );
  }

  function somar(A, B) {
    return criar(A.length, A[0].length, (i, j) => A[i][j].mais(B[i][j]));
  }

  function subtrair(A, B) {
    return criar(A.length, A[0].length, (i, j) => A[i][j].menos(B[i][j]));
  }

  function escalar(k, A) {
    return criar(A.length, A[0].length, (i, j) => k.vezes(A[i][j]));
  }

  function multiplicar(A, B) {
    const p = B.length;
    return criar(A.length, B[0].length, (i, j) => {
      let soma = ZERO;
      for (let k = 0; k < p; k++) soma = soma.mais(A[i][k].vezes(B[k][j]));
      return soma;
    });
  }

  function transpor(A) {
    return criar(A[0].length, A.length, (i, j) => A[j][i]);
  }

  function oposta(A) {
    return criar(A.length, A[0].length, (i, j) => A[i][j].oposto());
  }

  // Eliminação de Gauss exata: cada troca de linhas inverte o sinal.
  function determinante(A) {
    const n = A.length;
    const M = copiar(A);
    let det = UM;
    for (let c = 0; c < n; c++) {
      let p = c;
      while (p < n && M[p][c].ehZero) p++;
      if (p === n) return ZERO;
      if (p !== c) {
        [M[p], M[c]] = [M[c], M[p]];
        det = det.oposto();
      }
      const pivo = M[c][c];
      det = det.vezes(pivo);
      for (let r = c + 1; r < n; r++) {
        if (M[r][c].ehZero) continue;
        const fator = M[r][c].divididoPor(pivo);
        for (let k = c; k < n; k++) M[r][k] = M[r][k].menos(fator.vezes(M[c][k]));
      }
    }
    return det;
  }

  // Matriz sem a linha i e a coluna j (usada nos cofatores).
  function menorComplementar(A, i, j) {
    return A.filter((_, r) => r !== i).map((linha) => linha.filter((_, c) => c !== j));
  }

  /* Regra de Sarrus (ordem 3). As posições usam a matriz "estendida",
     com as duas primeiras colunas repetidas à direita (colunas 3 e 4). */
  function sarrus(A) {
    const diagonal = (colunaInicial, passo) => {
      const celulas = [0, 1, 2].map((r) => [r, colunaInicial + passo * r]);
      const valores = celulas.map(([r, c]) => A[r][c % 3]);
      const produto = valores.reduce((acc, v) => acc.vezes(v), UM);
      return { celulas, valores, produto };
    };
    const principais = [0, 1, 2].map((s) => diagonal(s, 1));
    const secundarias = [2, 3, 4].map((s) => diagonal(s, -1));
    const P = principais.reduce((acc, d) => acc.mais(d.produto), ZERO);
    const S = secundarias.reduce((acc, d) => acc.mais(d.produto), ZERO);
    return { principais, secundarias, P, S, det: P.menos(S) };
  }

  /* Teorema de Laplace: desenvolve pela fila (linha ou coluna) com mais zeros.
     Em empate, fica a primeira linha encontrada. */
  function laplace(A) {
    const n = A.length;
    let melhor = { eixo: "linha", indice: 0, zeros: -1 };
    for (let i = 0; i < n; i++) {
      const zeros = A[i].filter((v) => v.ehZero).length;
      if (zeros > melhor.zeros) melhor = { eixo: "linha", indice: i, zeros };
    }
    for (let j = 0; j < n; j++) {
      const zeros = A.filter((linha) => linha[j].ehZero).length;
      if (zeros > melhor.zeros) melhor = { eixo: "coluna", indice: j, zeros };
    }

    const termos = [];
    let det = ZERO;
    for (let t = 0; t < n; t++) {
      const [i, j] = melhor.eixo === "linha" ? [melhor.indice, t] : [t, melhor.indice];
      const a = A[i][j];
      const sinal = (i + j) % 2 === 0 ? 1 : -1;
      if (a.ehZero) {
        termos.push({ i, j, a, sinal, nulo: true });
        continue;
      }
      const menor = menorComplementar(A, i, j);
      const detMenor = determinante(menor);
      const cofator = sinal === 1 ? detMenor : detMenor.oposto();
      const produto = a.vezes(cofator);
      det = det.mais(produto);
      termos.push({ i, j, a, sinal, menor, detMenor, cofator, produto, nulo: false });
    }
    return { ...melhor, termos, det };
  }

  /* Gauss-Jordan em [A | I]. Registra as operações elementares de cada
     coluna-pivô e o estado da matriz aumentada depois delas.
     Prefere pivôs ±1 (contas mais limpas, como se faz no caderno). */
  function gaussJordan(A) {
    const n = A.length;
    const I = identidade(n);
    const M = A.map((linha, i) => [...linha, ...I[i]]);
    const inicial = copiar(M);
    const etapas = [];

    for (let c = 0; c < n; c++) {
      const ops = [];
      let p = -1;
      for (let r = c; r < n; r++) {
        if (M[r][c].ehZero) continue;
        if (p === -1) p = r;
        if (M[r][c].abs().ehUm) {
          p = r;
          break;
        }
      }
      if (p === -1) return { singular: true, inicial, etapas };

      if (p !== c) {
        [M[p], M[c]] = [M[c], M[p]];
        ops.push({ tipo: "troca", i: c, j: p });
      }
      const pivo = M[c][c];
      if (!pivo.ehUm) {
        const k = pivo.inverso();
        M[c] = M[c].map((v) => v.vezes(k));
        ops.push({ tipo: "escala", i: c, k });
      }
      for (let r = 0; r < n; r++) {
        if (r === c || M[r][c].ehZero) continue;
        const k = M[r][c];
        M[r] = M[r].map((v, t) => v.menos(k.vezes(M[c][t])));
        ops.push({ tipo: "combina", i: r, j: c, k });
      }
      if (ops.length) etapas.push({ coluna: c, ops, matriz: copiar(M) });
    }

    return { singular: false, inicial, etapas, inversa: M.map((linha) => linha.slice(n)) };
  }

  function inversa(A) {
    const gj = gaussJordan(A);
    return gj.singular ? null : gj.inversa;
  }

  // [A¹, A², …, Aⁿ]
  function potencias(A, n) {
    const lista = [];
    let atual = A;
    for (let e = 1; e <= n; e++) {
      lista.push(atual);
      if (e < n) atual = multiplicar(atual, A);
    }
    return lista;
  }

  function filaNula(fila) {
    return fila.every((v) => v.ehZero);
  }

  // v = k·u para algum k (comparação cruzada evita dividir por zero).
  function proporcionais(u, v) {
    if (filaNula(u) || filaNula(v)) return false;
    const t = u.findIndex((x) => !x.ehZero);
    if (v[t].ehZero) return false;
    return u.every((x, c) => x.vezes(v[t]).igual(v[c].vezes(u[t])));
  }

  /* Propriedades que zeram ou simplificam o determinante — a interface
     mostra como observação, do jeito que se cobra na prova. */
  function propriedadesDeterminante(A) {
    const n = A.length;
    const notas = [];
    if (n < 2) return notas;
    const colunas = transpor(A);
    const grupos = [
      { filas: A, nome: "linha", sigla: "L" },
      { filas: colunas, nome: "coluna", sigla: "C" },
    ];

    for (const { filas, nome, sigla } of grupos) {
      const i = filas.findIndex(filaNula);
      if (i !== -1) {
        notas.push({ tipo: "nula", nome, sigla, i });
        return notas;
      }
    }

    for (const { filas, nome, sigla } of grupos) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const u = filas[i];
          const v = filas[j];
          if (u.every((x, c) => x.igual(v[c]))) {
            notas.push({ tipo: "iguais", nome, sigla, i, j });
            return notas;
          }
          if (proporcionais(u, v)) {
            const t = u.findIndex((x) => !x.ehZero);
            notas.push({ tipo: "proporcionais", nome, sigla, i, j, k: v[t].divididoPor(u[t]) });
            return notas;
          }
        }
      }
    }

    let superior = true;
    let inferior = true;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i > j && !A[i][j].ehZero) superior = false;
        if (i < j && !A[i][j].ehZero) inferior = false;
      }
    }
    if (superior || inferior) notas.push({ tipo: superior && inferior ? "diagonal" : "triangular" });
    return notas;
  }

  window.Matrizes = {
    criar,
    identidade,
    iguais,
    somar,
    subtrair,
    escalar,
    multiplicar,
    transpor,
    oposta,
    determinante,
    sarrus,
    laplace,
    gaussJordan,
    inversa,
    potencias,
    propriedadesDeterminante,
  };
})();
