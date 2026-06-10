/**
 * React Doctor Configuration
 * 
 * This configuration file sets up React Doctor to scan the React codebase
 * for common issues, bugs, and anti-patterns.
 */

/** @type {import('react-doctor').ReactDoctorConfig} */
const config = {
  // Files and directories to scan
  include: [
    'src/**/*.tsx',
    'src/**/*.jsx',
    'src/**/*.ts',
    'src/**/*.js'
  ],
  
  // Files and directories to exclude
  exclude: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '*.test.tsx',
    '*.test.jsx',
    '*.spec.tsx',
    '*.spec.jsx'
  ],
  
  // Output configuration
  output: {
    // Output format: 'json', 'text', 'github', 'gitlab', 'junit'
    format: 'json',
    // Output file path (default: stdout)
    file: 'reports/react-doctor-report.json',
    // Include summary statistics
    summary: true
  },
  
  // Rule configuration
  rules: {
    // Enable recommended rules
    recommended: true,
    
    // Custom rule configuration
    rules: {
      // Check for missing React import
      'missing-react-import': 'error',
      
      // Check for deprecated lifecycle methods
      'deprecated-lifecycle-methods': 'error',
      
      // Check for unknown props on DOM elements
      'unknown-props': 'error',
      
      // Check for invalid JSX props
      'invalid-jsx-props': 'error',
      
      // Check for unused props
      'unused-props': 'warn',
      
      // Check for children prop usage
      'children-as-string': 'warn',
      
      // Check for key props on arrays
      'missing-key': 'error',
      
      // Check for render props pattern
      'render-props': 'warn',
      
      // Check for high-order component usage
      'hoc': 'warn',
      
      // Check for class components
      'class-components': 'warn',
      
      // Check for UNSAFE_ lifecycle methods
      'unsafe-lifecycle': 'error',
      
      // Check for string refs
      'string-refs': 'error',
      
      // Check for findDOMNode usage
      'find-dom-node': 'error',
      
      // Check for dangerousHTML
      'dangerous-html': 'error',
      
      // Check for list-item-key
      'list-item-key': 'error',
      
      // Check for deprecated API usage
      'deprecated-api': 'error',
      
      // Check for missing prop types
      'missing-prop-types': 'warn',
      
      // Check for prop type definition correctness
      'correct-prop-types': 'error',
      
      // Check for default props usage
      'default-props': 'warn',
      
      // Check for state definition in classes
      'class-state': 'warn',
      
      // Check for constructor in classes
      'constructor-state': 'warn',
      
      // Check for bind in constructor
      'constructor-bind': 'warn',
      
      // Check for render method
      'render-method': 'warn',
      
      // Check for stateless component
      'stateless-component': 'warn',
      
      // Check for state pattern
      'state-pattern': 'warn',
      
      // Check for pure component
      'pure-component': 'warn',
      
      // Check for extend component
      'extend-component': 'warn',
      
      // Check for public class fields
      'public-class-fields': 'warn',
      
      // Check for arrow functions
      'arrow-functions': 'warn',
      
      // Check for destructuring
      'destructuring': 'warn',
      
      // Check for module scope
      'module-scope': 'warn',
      
      // Check for no side effects
      'no-side-effects': 'warn',
      
      // Check for no direct state mutation
      'no-direct-state-mutation': 'error',
      
      // Check for no bind in render
      'no-bind-in-render': 'warn',
      
      // Check for no is mounted
      'no-is-mounted': 'error',
      
      // Check for no find dom node
      'no-find-dom-node': 'error',
      
      // Check for no string refs
      'no-string-refs': 'error',
      
      // Check for no unknown property
      'no-unknown-property': 'error',
      
      // Check for no unused props
      'no-unused-props': 'warn',
      
      // Check for no children prop
      'no-children-prop': 'warn',
      
      // Check for missing React import
      'missing-react-import': 'error',
      
      // Check for missing key prop
      'missing-key-prop': 'error',
      
      // Check for deprecated API
      'deprecated-api': 'error',
      
      // Check for prop type definition
      'prop-type-definition': 'error',
      
      // Check for default props
      'default-props-definition': 'warn',
      
      // Check for state definition
      'state-definition': 'warn',
      
      // Check for constructor
      'constructor-definition': 'warn',
      
      // Check for render method
      'render-method-definition': 'warn'
    }
  },
  
  // Severity configuration
  severity: {
    // Error severity for critical issues
    error: [
      'missing-react-import',
      'deprecated-lifecycle-methods',
      'unknown-props',
      'invalid-jsx-props',
      'missing-key',
      'unsafe-lifecycle',
      'string-refs',
      'find-dom-node',
      'dangerous-html',
      'list-item-key',
      'deprecated-api',
      'missing-prop-types',
      'correct-prop-types',
      'class-state',
      'constructor-state',
      'constructor-bind',
      'class-components',
      'dangerous-html',
      'no-direct-state-mutation',
      'no-is-mounted',
      'no-find-dom-node',
      'no-string-refs',
      'no-unknown-property',
      'no-deprecated-api',
      'no-missing-key'
    ],
    // Warning severity for moderate issues
    warning: [
      'unused-props',
      'children-as-string',
      'render-props',
      'hoc',
      'missing-prop-types',
      'default-props',
      'stateless-component',
      'state-pattern',
      'pure-component',
      'extend-component',
      'public-class-fields',
      'arrow-functions',
      'destructuring',
      'module-scope',
      'no-side-effects',
      'no-bind-in-render',
      'missing-key-prop',
      'prop-type-definition',
      'default-props-definition',
      'state-definition',
      'constructor-definition',
      'render-method-definition'
    ]
  },
  
  // Plugin configuration
  plugins: []
};

module.exports = config;
