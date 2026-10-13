/* Números racionais exatos (frações) usando BigInt.
   Toda conta da calculadora passa por aqui, então nada é arredondado:
   1/3 continua sendo 1/3 do começo ao fim. */
(function () {
  "use strict";

  function abs(a) {
    return a < 0n ? -a : a;
  }

  function mdc(a, b) {
    a = abs(a);
    b = abs(b);
    while (b) {
      const r = a % b;
      a = b;
      b = r;
    }
    return a;
  }

  // "12.50" -> 1250/100 (antes de simplificar)
  function decimalParaFracao(texto) {
    const [inteira, decimal = ""] = texto.split(".");
    const digitos = (inteira + decimal).replace(/^0+(?=\d)/, "") || "0";
    return new Fracao(BigInt(digitos), 10n ** BigInt(decimal.length));
  }

  class Fracao {
    constructor(num, den = 1n) {
      num = BigInt(num);
      den = BigInt(den);
      if (den === 0n) throw new RangeError("Denominador igual a zero.");
      if (den < 0n) {
        num = -num;
        den = -den;
      }
      const g = mdc(num, den);
      this.num = g > 1n ? num / g : num;
      this.den = g > 1n ? den / g : den;
      Object.freeze(this);
    }

    /* Aceita inteiros (-3), decimais com vírgula ou ponto (1,5) e frações (3/4, -1/2, 1,5/2).
       Campo vazio vale 0. Lança Error com mensagem amigável se o texto for inválido. */
    static ler(texto) {
      const s = String(texto)
        .trim()
        .replace(/\s+/g, "")
        .replace(/[−–—]/g, "-")
        .replace(/,/g, ".");
      if (s === "") return Fracao.ZERO;
      const m = /^([+-]?)(\d+\.?\d*|\.\d+)(?:\/([+-]?)(\d+\.?\d*|\.\d+))?$/.exec(s);
      if (!m) throw new Error("não é um número válido");
      let f = decimalParaFracao(m[2]);
      if (m[1] === "-") f = f.oposto();
      if (m[4] !== undefined) {
        let d = decimalParaFracao(m[4]);
        if (m[3] === "-") d = d.oposto();
        if (d.ehZero) throw new Error("o denominador não pode ser zero");
        f = f.divididoPor(d);
      }
      return f;
    }

    static de(n) {
      return n instanceof Fracao ? n : new Fracao(n);
    }

    mais(o) {
      return new Fracao(this.num * o.den + o.num * this.den, this.den * o.den);
    }

    menos(o) {
      return new Fracao(this.num * o.den - o.num * this.den, this.den * o.den);
    }

    vezes(o) {
      return new Fracao(this.num * o.num, this.den * o.den);
    }

    divididoPor(o) {
      if (o.num === 0n) throw new RangeError("Divisão por zero.");
      return new Fracao(this.num * o.den, this.den * o.num);
    }

    oposto() {
      return new Fracao(-this.num, this.den);
    }

    inverso() {
      return new Fracao(this.den, this.num);
    }

    abs() {
      return this.num < 0n ? this.oposto() : this;
    }

    get ehZero() {
      return this.num === 0n;
    }

    get ehUm() {
      return this.num === 1n && this.den === 1n;
    }

    get ehInteiro() {
      return this.den === 1n;
    }

    get ehNegativo() {
      return this.num < 0n;
    }

    igual(o) {
      return this.num === o.num && this.den === o.den;
    }

    paraNumero() {
      return Number(this.num) / Number(this.den);
    }

    // Texto simples para copiar: "-3/4", "5"
    paraTexto() {
      return this.den === 1n ? this.num.toString() : `${this.num}/${this.den}`;
    }

    /* Representação decimal com vírgula. `exato` diz se a fração cabe
       nessas casas sem arredondar (1/4 sim, 1/3 não). */
    decimal(casas = 4) {
      const escala = 10n ** BigInt(casas);
      const n = abs(this.num);
      const exato = (n * escala) % this.den === 0n;
      const q = (2n * n * escala + this.den) / (2n * this.den);
      const inteiro = (q / escala).toString();
      const frac = (q % escala).toString().padStart(casas, "0").replace(/0+$/, "");
      const negativo = this.num < 0n && q !== 0n;
      return { texto: (negativo ? "−" : "") + inteiro + (frac ? "," + frac : ""), exato };
    }
  }

  Fracao.ZERO = new Fracao(0n);
  Fracao.UM = new Fracao(1n);

  window.Fracao = Fracao;
})();
