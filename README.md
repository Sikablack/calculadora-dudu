Calculadora Científica de Números Complexos — UNIFACS
📘 Descrição
Este projeto implementa uma calculadora científica de números complexos em Node.js, com suporte a:
- operações aritméticas (+, -, ×, ÷, potência);
- funções como conj(z), sqrt(z) e root(z, n);
- análise sintática de expressões (parser com shunting-yard);
- avaliação interativa de expressões com variáveis;
- verificação de igualdade numérica entre duas expressões.

O programa é executado via linha de comando (CLI) e não possui interface web.

⚙️ Funcionalidades
✅ Representação de números complexos no formato a + bi
✅ Operações matemáticas:
  - Soma, subtração, multiplicação e divisão
  - Potência (** ou ^)
  - Conjugado (conj(z)), raiz quadrada (sqrt(z)), e raiz n-ésima (root(z, n))
✅ Impressão da árvore sintática abstrata (AST) em notação Lisp
✅ Avaliação de expressões com variáveis (ex: a*b + conj(c))
✅ Verificação de igualdade entre expressões (teste numérico aleatório)
✅ Tratamento de erros:
  - Sintaxe inválida
  - Parênteses desbalanceados
  - Divisão por zero

🧰 Tecnologias Utilizadas
- Node.js (CLI)
- JavaScript (ES6)
- Módulo readline para interação no terminal
- (O express aparece nas dependências, mas não é utilizado neste código)

🚀 Como Executar
1️⃣ Pré-requisitos: Node.js versão 18 ou superior.
2️⃣ Instalar dependências:
•	npm install
3️⃣ Executar a calculadora:
•	node complex_calc.js
4️⃣ Usar o menu interativo conforme instruções no terminal.
💡 Exemplos de Uso
Exemplo 1: (3+2i)*(1-4i) → Resultado: 11-10i
Exemplo 2: (a+b)*conj(c) → Árvore (LISP): (* (+ a b) (conj c))
Exemplo 3: (a+b)**2 e a**2 + 2*a*b + b**2 → equivalentes

🧩 Estrutura do Projeto
calculadora-dudu/
├── complex_calc.js          # Código principal da calculadora
├── package.json             # Metadados do projeto e dependências
├── package-lock.json        # Lockfile do npm
└── README.docx              # Este arquivo

