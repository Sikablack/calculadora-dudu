/*
Calculadora científica de números complexos (Node.js)
Entrega: arquivo único CLI - complex_calc.js

Funcionalidades implementadas:
- Representação de números complexos (a + bi / a - bi / bi / a)
- Aritmética: + - * / ** (potência), conj(expr), sqrt(expr), root(expr,n)
- Parser de expressões (shunting-yard) -> AST
- Impressão da árvore sintática em notação LISP
- Execução da expressão pedindo valores para variáveis
- Verificação de igualdade entre duas expressões (avaliativa)
- Detecção de erros: sintaxe, parênteses, divisão por zero, operadores inválidos

Como usar:
1) Salve como complex_calc.js
2) Execute: node complex_calc.js
3) Siga o menu interativo no terminal

Limitações / notas:
- A verificação de igualdade é numérica: avalia as expressões com atribuições aleatórias
  para variáveis (ou sem variáveis) e compara o resultado com tolerância.
- A árvore LISP é impressa em prefixo: (op left right) ou (func arg1 arg2 ...)

*/

// ---------------- Complex class ----------------
class Complex {
  constructor(re, im) {
    this.re = +re || 0;
    this.im = +im || 0;
  }
  toString() {
    const re = Number(this.re.toFixed(10));
    const im = Number(this.im.toFixed(10));
    const reStr = (Math.abs(re) < 1e-12) ? '0' : String(re);
    if (Math.abs(im) < 1e-12) return `${reStr}`;
    const sign = (im >= 0) ? '+' : '-';
    const imAbs = Math.abs(im) === 1 ? 'i' : `${Math.abs(im)}i`;
    return `${reStr}${sign}${imAbs}`;
  }
  add(b){return new Complex(this.re + b.re, this.im + b.im);} 
  sub(b){return new Complex(this.re - b.re, this.im - b.im);} 
  mul(b){
    return new Complex(this.re*b.re - this.im*b.im, this.re*b.im + this.im*b.re);
  }
  div(b){
    const denom = b.re*b.re + b.im*b.im;
    if (denom === 0) throw new Error('Divisão por zero (complexo)');
    return new Complex((this.re*b.re + this.im*b.im)/denom, (this.im*b.re - this.re*b.im)/denom);
  }
  conj(){return new Complex(this.re, -this.im);} 
  abs(){return Math.hypot(this.re, this.im);} 
  neg(){return new Complex(-this.re, -this.im);} 
  eq(b, tol=1e-8){return Math.abs(this.re-b.re) < tol && Math.abs(this.im-b.im) < tol;} 
  // complex power using polar form for non-integer exponents
  pow(b){
    // if b is real integer, use repeated multiplication for stability
    if (Math.abs(b.im) < 1e-14 && Number.isInteger(b.re)){
      let n = b.re;
      if (n === 0) return new Complex(1,0);
      let res = new Complex(1,0);
      const base = new Complex(this.re, this.im);
      const positive = n > 0;
      n = Math.abs(n);
      for(let i=0;i<n;i++) res = res.mul(base);
      if (!positive) return new Complex(1,0).div(res);
      return res;
    }
    const r = this.abs();
    const theta = Math.atan2(this.im, this.re);
    const a = b.re, c = b.im;
    // (r e^{i theta})^{a+ci} = r^a * e^{-c theta} * e^{i( a theta + c ln r )}
    const mag = Math.pow(r, a) * Math.exp(-c * theta);
    const ang = a * theta + c * Math.log(Math.max(r, 1e-300));
    return new Complex(mag * Math.cos(ang), mag * Math.sin(ang));
  }
  sqrt(){
    const r = this.abs();
    const re = Math.sqrt((r + this.re)/2);
    const im = (this.im >= 0) ? Math.sqrt((r - this.re)/2) : -Math.sqrt((r - this.re)/2);
    return new Complex(re, im);
  }
  root(n){
    // principal nth root
    if (!Number.isInteger(n) || n === 0) throw new Error('root: n deve ser inteiro não-zero');
    const r = this.abs();
    const theta = Math.atan2(this.im, this.re);
    const mag = Math.pow(r, 1/n);
    const ang = theta / n;
    return new Complex(mag * Math.cos(ang), mag * Math.sin(ang));
  }
}

// ---------------- Tokenizer ----------------
const TOKEN_REGEX = /\s*([0-9]*\.?[0-9]+(?:e[+-]?\d+)?i?|[A-Za-z_]\w*|\*\*|\^|[()+\-*/,])\s*/y;

function tokenize(input){
  const tokens = [];
  TOKEN_REGEX.lastIndex = 0;
  let m;
  while((m = TOKEN_REGEX.exec(input)) !== null){
    tokens.push(m[1]);
  }
  // validate full coverage
  const joined = tokens.join('');
  const cleaned = input.replace(/\s+/g, '');
  if (joined !== cleaned){
    throw new Error('Tokenização falhou: caracteres inválidos na expressão');
  }
  return tokens;
}

// ---------------- Parser (shunting-yard -> AST) ----------------

const OPERATORS = {
  '+': {prec: 2, assoc: 'L', args:2},
  '-': {prec: 2, assoc: 'L', args:2},
  '*': {prec: 3, assoc: 'L', args:2},
  '/': {prec: 3, assoc: 'L', args:2},
  '**':{prec: 5, assoc: 'R', args:2},
  '^':{prec: 5, assoc: 'R', args:2},
  'u-':{prec:6, assoc:'R', args:1} // unary minus
};

function isNumberToken(t){
  return /^[0-9]*\.?[0-9]+(?:e[+-]?\d+)?i?$/.test(t);
}
function isImagToken(t){
  return /i$/.test(t) && !/[A-Za-z]/.test(t);
}
function isIdentifier(t){
  return /^[A-Za-z_]\w*$/.test(t);
}

function parseToAST(input){
  const tokens = tokenize(input);
  const output = [];
  const ops = [];
  let prev = null;
  for(let i=0;i<tokens.length;i++){
    const t = tokens[i];
    if (isNumberToken(t)){
      // number or imaginary number
      output.push({type:'number', value: t});
      prev = 'number';
    } else if (isIdentifier(t)){
      // could be function or variable
      // lookahead for '(' => function
      const next = tokens[i+1];
      if (next === '('){
        ops.push({type:'func', name:t});
      } else {
        output.push({type:'var', name:t});
      }
      prev = 'id';
    } else if (t === ','){
      // function arg separator: pop operators until left paren
      while(ops.length && ops[ops.length-1] !== '('){
        output.push(ops.pop());
      }
      if (!ops.length) throw new Error('Separador de argumentos fora de função');
      prev = ',';
    } else if (t === '('){
      ops.push('(');
      prev = '(';
    } else if (t === ')'){
      while(ops.length && ops[ops.length-1] !== '('){
        output.push(ops.pop());
      }
      if (!ops.length) throw new Error('Parênteses desbalanceados: falta (');
      ops.pop(); // remove '('
      // if function on top, pop it to output as func node
      if (ops.length && typeof ops[ops.length-1] === 'object' && ops[ops.length-1].type === 'func'){
        output.push(ops.pop());
      }
      prev = ')';
    } else if (t in OPERATORS || t === '^' || t === '**'){
      // handle unary -
      let op = t;
      if (t === '-' && (prev === null || prev === '(' || prev === ',' || (prev in OPERATORS))) {
        op = 'u-';
      }
      const o1 = OPERATORS[op] || OPERATORS[t];
      if (!o1) throw new Error('Operador desconhecido: '+t);
      while(ops.length){
        const top = ops[ops.length-1];
        if (typeof top === 'string' && top === '(') break;
        if (typeof top === 'object' && top.type === 'func') break;
        const o2 = OPERATORS[top];
        if (!o2) break;
        if ((o1.assoc === 'L' && o1.prec <= o2.prec) || (o1.assoc === 'R' && o1.prec < o2.prec)){
          output.push(ops.pop());
        } else break;
      }
      ops.push(op);
      prev = op;
    } else {
      throw new Error('Token inválido: '+t);
    }
  }
  while(ops.length){
    const top = ops.pop();
    if (top === '(' || top === ')') throw new Error('Parênteses desbalanceados');
    output.push(top);
  }
  // Now output is RPN with function objects and operator strings and number/var tokens
  // Build AST from RPN
  const stack = [];
  for(const tok of output){
    if (tok.type === 'number'){
      stack.push({type:'literal', value: tok.value});
    } else if (tok.type === 'var'){
      stack.push({type:'var', name: tok.name});
    } else if (typeof tok === 'object' && tok.type === 'func'){
      // pop function arguments until marker? We don't have arg counts; we'll parse by reading preceding items and the function call was created when ')' found - complicated.
      // Simpler: for supported functions, know arg counts: conj(1), sqrt(1), root(2)
      const fn = tok.name;
      const arity = (fn === 'root') ? 2 : 1;
      const args = [];
      for(let i=0;i<arity;i++){
        if (!stack.length) throw new Error('Argumentos insuficientes para função '+fn);
        args.unshift(stack.pop());
      }
      stack.push({type:'call', name:fn, args});
    } else if (typeof tok === 'string'){
      // operator
      const op = tok;
      const info = OPERATORS[op];
      const args = [];
      for(let i=0;i<info.args;i++){
        if (!stack.length) throw new Error('Argumentos insuficientes para operador '+op);
        args.unshift(stack.pop());
      }
      stack.push({type:'op', op, args});
    } else {
      throw new Error('Erro interno no RPN -> AST');
    }
  }
  if (stack.length !== 1) throw new Error('Expressão inválida ou ambígua');
  return stack[0];
}

// ---------------- AST utilities ----------------
function astToLisp(node){
  if (!node) return '';
  if (node.type === 'literal') return node.value;
  if (node.type === 'var') return node.name;
  if (node.type === 'call'){
    return `(${node.name} ${node.args.map(astToLisp).join(' ')})`;
  }
  if (node.type === 'op'){
    const name = node.op;
    if (node.args.length === 1) return `(${name} ${astToLisp(node.args[0])})`;
    return `(${name} ${node.args.map(astToLisp).join(' ')})`;
  }
  return '';
}

function collectVars(node, set){
  if (!set) set = new Set();
  if (node.type === 'var') set.add(node.name);
  else if (node.type === 'call') node.args.forEach(a=>collectVars(a,set));
  else if (node.type === 'op') node.args.forEach(a=>collectVars(a,set));
  return set;
}

// ---------------- Evaluation ----------------
function parseComplexLiteral(token){
  // token is like '3', '4i', '3.5', '2.1e-3i', '3i'
  if (/i$/.test(token)){
    const num = token.slice(0,-1);
    const im = (num === '' || num === '+') ? 1 : (num === '-') ? -1 : Number(num);
    if (Number.isNaN(im)) throw new Error('Literal imaginário inválido: '+token);
    return new Complex(0, im);
  } else {
    const n = Number(token);
    if (Number.isNaN(n)) throw new Error('Literal numérico inválido: '+token);
    return new Complex(n, 0);
  }
}

function evaluateAST(node, env){
  if (node.type === 'literal') return parseComplexLiteral(node.value);
  if (node.type === 'var'){
    if (!(node.name in env)) throw new Error('Variável sem valor: '+node.name);
    return env[node.name];
  }
  if (node.type === 'call'){
    const args = node.args.map(a=>evaluateAST(a, env));
    switch(node.name){
      case 'conj': return args[0].conj();
      case 'sqrt': return args[0].sqrt();
      case 'root': {
        // second arg must be integer literal numeric
        const nArg = node.args[1];
        // evaluate and ensure real integer
        const nVal = evaluateAST(node.args[1], env);
        if (Math.abs(nVal.im) > 1e-12) throw new Error('root: segundo argumento deve ser inteiro real');
        const n = Math.round(nVal.re);
        return args[0].root(n);
      }
      default: throw new Error('Função desconhecida: '+node.name);
    }
  }
  if (node.type === 'op'){
    if (node.op === 'u-'){
      const v = evaluateAST(node.args[0], env); return v.neg();
    }
    const a = evaluateAST(node.args[0], env);
    const b = evaluateAST(node.args[1], env);
    switch(node.op){
      case '+': return a.add(b);
      case '-': return a.sub(b);
      case '*': return a.mul(b);
      case '/': return a.div(b);
      case '**': return a.pow(b);
      case '^': return a.pow(b);
      default: throw new Error('Operador não implementado: '+node.op);
    }
  }
  throw new Error('Nó AST inválido');
}

// ---------------- Equality check (numerical) ----------------
function expressionsEqual(ast1, ast2, tries=6, tol=1e-7){
  const vars = new Set([...collectVars(ast1), ...collectVars(ast2)]);
  // for each trial, assign random complex values to variables
  for(let t=0;t<tries;t++){
    const env = {};
    for(const v of vars){
      // choose random real in [-5,5] and imag in [-5,5]
      const re = (Math.random()*10 - 5);
      const im = (Math.random()*10 - 5);
      env[v] = new Complex(re, im);
    }
    try{
      const r1 = evaluateAST(ast1, env);
      const r2 = evaluateAST(ast2, env);
      if (!r1.eq(r2, tol)) return false;
    } catch(e){
      // if evaluation error (e.g., division by zero), try other random
      t--; if (t<0) throw e;
      continue;
    }
  }
  return true;
}

// ---------------- CLI ----------------
const readline = require('readline');
const rl = readline.createInterface({input:process.stdin, output:process.stdout});
function question(q){
  return new Promise(res=>rl.question(q, ans=>res(ans)));
}

function parseComplexInput(str){
  // accept forms like: 3+4i, -2 - 3i, 4i, 5, i, -i
  str = str.replace(/\s+/g, '');
  if (str === 'i') return new Complex(0,1);
  if (str === '-i') return new Complex(0,-1);
  const m = str.match(/^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)?([+-]?\d*\.?\d+(?:e[+-]?\d+)?)?i?$/i);
  // fallback: try evaluate as real number
  if (m){
    // crude but works for many cases
    if (str.includes('i')){
      // separate real and imag
      // find last + or - before the imaginary part
      const idx = Math.max(str.lastIndexOf('+', str.length-2), str.lastIndexOf('-', str.length-2));
      if (idx > 0){
        const real = Number(str.slice(0, idx));
        const imagPart = str.slice(idx, str.length-1);
        const imag = imagPart === '+' ? 1 : (imagPart === '-' ? -1 : Number(imagPart));
        return new Complex(real, imag);
      } else {
        const imag = Number(str.slice(0, str.length-1));
        return new Complex(0, imag);
      }
    } else {
      const re = Number(str);
      if (Number.isNaN(re)) throw new Error('Formato de complexo inválido');
      return new Complex(re, 0);
    }
  }
  // try evaluate patterns like 3+4i with regex
  const alt = str.match(/^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)([+-]\d*\.?\d+(?:e[+-]?\d+)?)i$/i);
  if (alt){
    return new Complex(Number(alt[1]), Number(alt[2]));
  }
  throw new Error('Não pude interpretar o complexo. Exemplos válidos: 3+4i, -2-3i, 4i, 5, i');
}

async function promptForEnv(ast){
  const vars = Array.from(collectVars(ast));
  const env = {};
  for(const v of vars){
    let ok = false;
    while(!ok){
      const ans = await question(`Valor para variável ${v} (ex: 3+4i): `);
      try{
        env[v] = parseComplexInput(ans.trim());
        ok = true;
      } catch(e){
        console.log('Entrada inválida:', e.message);
      }
    }
  }
  return env;
}

async function mainMenu(){
  console.log('\n=== Calculadora de Números Complexos ===');
  console.log('Opções:');
  console.log('1) Avaliar expressão');
  console.log('2) Mostrar árvore LISP de expressão');
  console.log('3) Verificar igualdade de duas expressões (numérica)');
  console.log('4) Sair');
  const opt = await question('Escolha: ');
  return opt.trim();
}

(async function(){
  while(true){
    const opt = await mainMenu();
    try{
      if (opt === '1'){
        const expr = await question('Digite a expressão: ');
        const ast = parseToAST(expr);
        const env = await promptForEnv(ast);
        const res = evaluateAST(ast, env);
        console.log('Resultado:', res.toString());
      } else if (opt === '2'){
        const expr = await question('Digite a expressão: ');
        const ast = parseToAST(expr);
        console.log('Árvore (LISP):', astToLisp(ast));
      } else if (opt === '3'){
        const e1 = await question('Expressão 1: ');
        const e2 = await question('Expressão 2: ');
        const ast1 = parseToAST(e1);
        const ast2 = parseToAST(e2);
        const eq = expressionsEqual(ast1, ast2);
        console.log(eq ? 'As expressões são (numericamente) equivalentes.' : 'As expressões NÃO são equivalentes.');
      } else if (opt === '4'){
        console.log('Saindo...'); break;
      } else {
        console.log('Opção inválida');
      }
    } catch(e){
      console.log('Erro:', e.message);
    }
  }
  rl.close();
})();