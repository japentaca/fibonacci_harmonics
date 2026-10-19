import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  {
    // Build output and dependencies are not part of the source
    ignores: ['dist/**', 'node_modules/**', 'coverage/**']
  },
  // The recommended rule set of eslint-plugin-vue, in flat config format
  ...pluginVue.configs['flat/recommended'],
  {
    // The app and its components
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    },
    rules: {
      'no-undef': 'error',
      // Unused arguments are kept for readability in the callbacks, and the
      // caught errors are only there to be swallowed on purpose
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      // The root component of a Vue app is a single word by convention
      'vue/multi-word-component-names': 'off',
      // These two rules only complain about the layout of the templates: they
      // want one attribute per line even in a short element, which adds a lot
      // of noise to the code without finding any real problem
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off'
    }
  },
  {
    // The unit tests run on the Node.js test runner
    files: ['**/*.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    }
  },
  {
    // The build and lint configuration files run on Node.js
    files: ['*.config.js', '.github/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    }
  }
]
