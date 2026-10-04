import javascript from '@eslint/js';
import typescriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  javascript.configs.recommended,
  ...typescriptPlugin.configs['flat/recommended'],
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      globals: globals.node,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "camelcase": [
        "error",
        {
          "properties": "never"
        }
      ],
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/consistent-return": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/init-declarations": "off",
      "@typescript-eslint/max-params": "off",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          "selector": "interface",
          "format": [
            "PascalCase"
          ],
          "custom": {
            "regex": "^I[A-Z]",
            "match": false
          }
        },
        {
          "selector": "typeAlias",
          "format": [
            "PascalCase"
          ]
        }
      ],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-loop-func": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "varsIgnorePattern": "^_$",
          "argsIgnorePattern": "^_$",
          "args": "after-used",
          "caughtErrors": "none",
          "ignoreRestSiblings": true
        }
      ],
      "@typescript-eslint/prefer-destructuring": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/prefer-readonly-parameter-types": "off",
      "@typescript-eslint/prefer-ts-expect-error": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
      "indent": [
        "error",
        2
      ],
      "max-len": [
        "error",
        {
          "code": 145
        }
      ],
      "no-console": [
        "error",
        {
          "allow": [
            "warn",
            "error"
          ]
        }
      ],
      "no-extra-semi": "off",
      "no-multi-spaces": [
        "error"
      ],
      "no-prototype-builtins": "warn",
      "no-restricted-imports": [
        "error",
        {
          "paths": [
            "prop-types"
          ],
          "patterns": [
            "prop-types/*",
            "*.css",
            "*.scss",
            "!*.module.scss"
          ]
        }
      ],
      "no-unused-vars": "off",
      "no-use-before-define": "error",
      "object-curly-spacing": [
        "error",
        "always"
      ],
      "quotes": [
        "error",
        "single",
        {
          "avoidEscape": true,
          "allowTemplateLiterals": true
        }
      ],
      "semi": [
        "error",
        "always"
      ],
      "space-in-parens": [
        "error",
        "never"
      ]
    },
  },
];
