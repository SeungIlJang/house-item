import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tsParser from '@typescript-eslint/parser'

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  FormData: 'readonly',
  File: 'readonly',
  CustomEvent: 'readonly',
  HTMLInputElement: 'readonly',
  console: 'readonly',
}

export default [
  { ignores: ['dist/**', 'node_modules/**', '**/*.d.ts'] },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: { 'no-undef': 'off' },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tsParser },
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      // Ionic 웹 컴포넌트는 네이티브 slot 속성을 사용하므로 Vue2 slot 경고를 끈다
      'vue/no-deprecated-slot-attribute': 'off',
      'no-undef': 'off',
    },
  },
]
