export const attackSkipPatterns: RegExp[] = [
  // === PERFORMANCE OPTIMIZED PATTERNS ===
  // Common attack patterns ordered by frequency for better performance

  // High-frequency bot and scanner patterns (most common)
  /Cannot GET \/favicon\.ico/i, // Favicon requests (very common bot traffic)
  /Cannot GET \/robots\.txt/i, // Robots.txt scanning (very common)
  /Cannot GET \/sitemap\.xml/i, // Sitemap scanning (very common)
  /Cannot GET \/\.well-known\//i, // Well-known URI scanning
  /Failed to decode param '%c0'/i, // Malformed percent-encoding probes

  // SQL Injection patterns (optimized for common attack vectors)
  /(?:union\s+(?:all\s+)?select|select\s+.*\s+from|insert\s+into|delete\s+from|drop\s+(?:table|database)|exec\s*\(|xp_cmdshell|information_schema|sleep\s*\(|waitfor\s+delay|benchmark\s*\()/i,
  /0x[0-9a-f]{6,}/i, // Hex encoded SQL injection (optimized length)

  // XSS patterns (consolidated for better performance)
  /(?:<script|javascript:|vbscript:|on\w+\s*=|alert\s*\(|document\.cookie|window\.location|eval\s*\(|expression\s*\()/i,

  // Command injection patterns (consolidated)
  // Note: Generic $() and backtick patterns were made more specific to avoid false positives
  // with legitimate shell output errors. Only match specific dangerous command sequences:
  /(?:;\s*(?:cat|ls|dir|whoami|id|uname|curl|wget|nc)\s+|;\s*id\s*$|`\s*(?:cat|ls|id|whoami|uname)\s*`)/i,

  // Path traversal patterns (consolidated)
  /(?:\.\.\/\.\.|\.\.\\\.\.\\|\/etc\/(?:passwd|shadow|hosts)|\/proc\/(?:version|self\/environ)|\/var\/log\/|\/(?:home\/.*\/|root\/)\.ssh\/|c:\\(?:windows\\(?:system32|win\.ini)|boot\.ini))/i,

  // NoSQL injection patterns (consolidated)
  /\$(?:ne|gt|lt|in|nin|regex|where)/i,

  // XXE/XML injection patterns (consolidated)
  /(?:<!(?:ENTITY|DOCTYPE)|SYSTEM\s+["'](?:file|http|ftp):|CDATA\[)/i,

  // SSRF patterns (consolidated)
  /(?:https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|metadata\.google\.internal|169\.254\.169\.254)|file:\/\/\/etc\/passwd|(?:ftp|gopher):\/\/)/i,

  // Header injection patterns (consolidated)
  /\r\n(?:Content-Type:|Set-Cookie:|Location:|X-Forwarded-For:)?/i,

  // Deserialization patterns - attack signatures for insecure deserialization
  /rO0AB/i, // Java serialization magic bytes (base64)
  /aced0005/i, // Java serialization hex
  /pickle/i, // Python pickle deserialization
  /cPickle/i, // Python cPickle deserialization
  /__reduce__/i, // Python object reduction
  /ObjectInputStream/i, // Java object input stream

  // Protocol confusion patterns
  /data:text\/html/i, // Data URI HTML
  /data:text\/javascript/i, // Data URI JavaScript
  /data:application\/javascript/i, // Data URI JavaScript app
  /data:image\/svg\+xml/i, // Data URI SVG
  /view-source:/i, // View source protocol

  // Credential scanning patterns - Important to avoid logging sensitive data
  // These patterns help prevent data leakage by not logging errors that may contain
  // actual credentials, tokens, or sensitive keys
  /api[_-]?key/i, // API key scanning (may contain actual keys)
  /access[_-]?token/i, // Access token scanning (may contain actual tokens)
  /secret[_-]?key/i, // Secret key scanning
  /private[_-]?key/i, // Private key scanning
  /password/i, // Password scanning
  /passwd/i, // Password scanning (also catches /etc/passwd probes)
  /pwd/i, // Password/pwd command scanning
  /rsa[_-]?private/i, // RSA private key
  /ssh[_-]?key/i, // SSH key scanning
  /bearer\s+[a-zA-Z0-9_-]+/i, // Bearer token scanning (may contain actual tokens)

  // Cryptocurrency patterns - Important for financial security
  /bitcoin/i, // Bitcoin scanning
  /ethereum/i, // Ethereum scanning
  /wallet\.dat/i, // Wallet file scanning
  /private\.key/i, // Private key file
  /\.pem/i, // PEM certificate file
  /\.p12/i, // PKCS12 certificate
  /\.pfx/i, // PFX certificate

  // Framework-specific patterns - Debug/admin endpoints scanning
  /\/debug\/pprof/i, // Go pprof debugging
  /\/debug\/vars/i, // Go debug variables
  /\/metrics/i, // Prometheus metrics
  /\/health/i, // Health check endpoints
  /\/status/i, // Status endpoints
  /\/actuator\/dump/i, // Spring Boot heap dump
  /\/actuator\/env/i, // Spring Boot environment
  /\/actuator\/trace/i, // Spring Boot trace
  /\/trace/i, // Laravel trace
  /\/console/i, // Web console access
  /\/profiler/i, // Profiler access

  // Business logic bypass patterns - Attack attempts
  /admin=true/i, // Admin bypass attempt
  /role=admin/i, // Role bypass attempt
  /is_admin=1/i, // Admin flag bypass
  /user_type=admin/i, // User type bypass
  /privilege=admin/i, // Privilege bypass
  /access_level=admin/i, // Access level bypass
  /permissions=admin/i, // Permissions bypass
  /debug=true/i, // Debug mode bypass
  /test=true/i, // Test mode bypass
  /demo=true/i, // Demo mode bypass

  // Invalid route patterns
  /Cannot POST \/apps/i, // Legacy or unsupported /apps POST entry point
  /Cannot POST \/api\/route/i, // Unsupported /api/route POST entry point
  /Cannot POST \/live_env/i, // Invalid route with URL encoding
  /Cannot POST \/_ignition\/execute-solution/i, // Laravel Ignition RCE vulnerability exploit attempt
  /Cannot POST \/livewire\/message/i, // Laravel Livewire component exploit attempt

  // === Cannot GET patterns - Common attack vectors ===

  // Asset scanning patterns (consolidated for better performance)
  /Cannot GET \/(?:assets|static|public)\/js\//i, // JS asset scanning
  /Cannot GET \/(?:js|cdn)\//i, // JS and CDN directory scanning

  // AWS and cloud service scanning patterns (consolidated)
  /Cannot GET .*(?:\/aws|\.aws\/|aws.*(?:credentials|config|secret|keys|settings)|awsconfig|awscredentials|aws-)/i,

  // Environment and configuration file scanning (consolidated)
  /Cannot GET .*(?:\.env|(?:config|settings|secrets|credentials|parameters|application)\.)/i,

  // === MODERN ATTACK PATTERNS (2024-2025) ===

  // AI/ML model attacks
  /Cannot GET .*(?:model|\.pkl|\.h5|\.onnx|\.pb|tensorflow|pytorch|huggingface)/i,

  // Container and orchestration attacks
  /Cannot GET .*(?:\.dockerignore|docker-compose|kubernetes|helm|k8s|containerd|podman)/i,

  // Modern framework attacks
  /Cannot GET .*(?:next\.config|nuxt\.config|vite\.config|remix\.config|astro\.config|svelte\.config)/i,

  // Serverless and edge computing attacks
  /Cannot GET .*(?:vercel|netlify|cloudflare|edge-config|serverless\.yml|functions\/)/i,

  // Modern CI/CD attacks
  /Cannot GET .*(?:\.github\/workflows|\.gitlab-ci|\.circleci|\.buildkite|\.drone)/i,

  // Infrastructure as Code attacks
  /Cannot GET .*(?:terraform|pulumi|cdk|cloudformation|ansible|chef|puppet)/i,

  // Modern security bypass attempts
  /Cannot GET .*(?:bypass|exploit|payload|shell|webshell|backdoor|trojan)/i,

  // GraphQL specific attacks
  /Cannot GET .*(?:graphql|introspection|__schema|__type|mutation|subscription)/i,
  /Cannot (?:POST|PUT|DELETE|PATCH|HEAD|OPTIONS) \/(?:graphql(?:\/api)?|api\/(?:gql|graphql))(?:\/.*)?/i,
  /Cannot POST .*graphql/i, // GraphQL POST requests
  /Cannot POST .*graphql\/graphiql/i, // GraphiQL interface POST requests
  /Cannot PUT .*graphql/i, // GraphQL PUT requests
  /Cannot DELETE .*graphql/i, // GraphQL DELETE requests
  /Cannot PATCH .*graphql/i, // GraphQL PATCH requests
  /Cannot OPTIONS .*graphql/i, // GraphQL OPTIONS requests
  /Cannot HEAD .*graphql/i, // GraphQL HEAD requests
  /GraphQL syntax error/i, // GraphQL query syntax errors
  /GraphQL validation error/i, // GraphQL schema validation errors
  /Field .* doesn't exist on type/i, // GraphQL field not found errors
  /Cannot query field .* on type/i, // GraphQL invalid field queries
  /Unknown directive/i, // GraphQL unknown directive errors
  /Variable .* is never used/i, // GraphQL unused variable errors
  /Variable .* of required type/i, // GraphQL variable type errors
  /Expected type .*, found/i, // GraphQL type mismatch errors
  /Argument .* of required type/i, // GraphQL argument type errors
  /Must provide query string/i, // GraphQL missing query errors

  // JWT and modern auth attacks
  /Cannot GET .*(?:jwt|oauth|oidc|saml|auth0|cognito|firebase-auth)/i,

  // API Gateway and microservices attacks
  /Cannot GET .*(?:gateway|microservice|service-mesh|istio|envoy|consul)/i,

  // Development and build file scanning (consolidated)
  /Cannot GET .*(?:swagger|vite|webpack|gatsby|next|karma|package|composer|yarn|npm)/i,

  // PHP and debug scanning (consolidated)
  /Cannot GET .*(?:phpinfo|info\.php|test.*\.php|server.*info|_profiler|debug)/i,

  // Legacy container scanning (already covered in modern patterns above)
  // Note: Docker/K8s patterns moved to modern section for better organization

  // Legacy CI/CD scanning (already covered in modern patterns above)
  // Note: CI/CD patterns moved to modern section for better organization

  // Backup and archive scanning (consolidated)
  /Cannot GET .*(?:backup|\.bak|\.old|\.tmp|-old|_backup|\.tar\.gz|\.zip)/i,

  // Database and logs scanning (consolidated)
  /Cannot GET .*(?:\.sql|database|\.log|logs\/|laravel\.log)/i,

  // API and internal endpoints scanning (consolidated)
  /Cannot GET .*(?:\/api\/.*(?:admin|secret|private|internal|config|credentials|keys)|\/admin\/|graphql)/i,

  // File manipulation and upload scanning (consolidated)
  /Cannot GET .*(?:upload|download|file.*manager|fetch.*url|proxy|remote|import|export)/i,

  // WordPress and CMS scanning (consolidated)
  /Cannot GET .*(?:wp-(?:content|includes|config)|xmlrpc|wlwmanifest)/i,

  // Version control and IDE scanning (consolidated)
  /Cannot GET .*(?:\.git\/|\.vscode\/|\.idea\/|\.output\/|\.expo)/i,

  // Mail and SMTP configuration scanning (consolidated)
  /Cannot GET .*(?:smtp|mail|nodemailer|email|sendgrid)/i,

  // Payment and service configuration scanning (consolidated)
  /Cannot GET .*(?:stripe|paypal|payment)/i,

  // Storage and CDN scanning (consolidated)
  /Cannot GET .*(?:s3\.|storage|cdn-cgi)/i,

  // Security and authentication scanning (consolidated)
  /Cannot GET .*(?:secret|private|secured|ssl|key\.|cert)/i,

  // Framework and library specific scanning (consolidated)
  /Cannot GET .*(?:laravel|bootstrap|vendor|node_modules|bundle\.)/i,

  // Specific high-value targets (consolidated)
  /Cannot GET .*(?:\/\.\/swagger-ui-init\.js|xampp\/phpinfo\.php|wp-content\/debug\.log|view\.php\?file=|ssrf|tmp\/|Procfile|Makefile)/i,

  // Platform-specific configurations (already covered in modern patterns above)
  // Note: netlify, vercel, firebase moved to modern serverless section

  // Generic attack vectors (consolidated)
  /Cannot GET .*(?:\/[pi]\.php|dump|\.rdb|BUILD_ID|trace)/i,

  // Additional HTTP methods and routes (consolidated)
  /(?:Cannot PUT .*\.jsp|Cannot PUT \/meta|Cannot GET \/wiki|Cannot POST .*allow_url_include)/i,

  // === PHP CONFIGURATION INJECTION ATTACKS ===
  // These patterns detect attempts to exploit PHP configuration directives
  // Attackers try to enable allow_url_include and inject malicious code via auto_prepend_file
  // Common attack vectors: RCE (Remote Code Execution) via PHP input streams
  // The attack attempts to enable dangerous PHP settings and execute arbitrary code
  /Cannot (?:GET|POST|PUT|DELETE|PATCH|HEAD) .*(?:allow_url_include|auto_prepend_file|auto_append_file|disable_functions|safe_mode|open_basedir)/i,

  // PHP stream wrappers exploitation (used with configuration injection)
  // Attackers combine these with allow_url_include to execute remote code
  /Cannot (?:GET|POST|PUT|DELETE|PATCH|HEAD) .*(?:php:\/\/(?:input|filter|fd|memory|temp)|data:\/\/|glob:\/\/|phar:\/\/)/i,

  // HEAD request scanning (consolidated)
  /Cannot HEAD \/(?:oldsite|OLD|new)/i,

  // === CONFIGURATION FILE RECONNAISSANCE PATTERNS ===
  // These patterns detect attempts to discover sensitive configuration files
  // Common attack vectors for configuration file discovery via HEAD requests

  // Application configuration files (JSON/YAML)
  /Cannot HEAD \/application\.(?:json|yaml|yml)/i,
  /Cannot HEAD \/(?:config|api)\/application\.(?:json|yaml|yml)/i,

  // Environment configuration files (.env variants)
  /Cannot HEAD \/\.env(?:\.(?:docker|local|production|staging|development|test))?/i,
  /Cannot HEAD \/(?:config|api|app)\/\.env/i,

  // Python settings and configuration files
  /Cannot HEAD \/(?:api\/)?settings\.py/i,
  /Cannot HEAD \/(?:app|config)\/settings\.py/i,

  // AWS configuration files
  /Cannot HEAD \/\.aws\/(?:config|credentials)/i,

  // Additional common configuration file patterns
  /Cannot HEAD \/(?:config|api|app)\/(?:database|db)\.(?:json|yml|yaml)/i,
  /Cannot HEAD \/(?:secrets|credentials)\.(?:json|yml|yaml)/i,
  /Cannot HEAD \/(?:local|production|staging|development)\.(?:json|yml|yaml|env)/i,

  // Framework-specific configuration files
  /Cannot HEAD \/(?:appsettings|web)\.config/i, // .NET configuration
  /Cannot HEAD \/hibernate\.(?:cfg\.xml|properties)/i, // Hibernate configuration
  /Cannot HEAD \/log4j\.(?:xml|properties)/i, // Log4j configuration
  /Cannot HEAD \/struts\.xml/i, // Struts configuration
  /Cannot HEAD \/spring\.(?:xml|properties)/i, // Spring configuration

  // Database configuration files
  /Cannot HEAD \/(?:database|db)\.(?:properties|ini|conf)/i,
  /Cannot HEAD \/(?:mysql|postgres|mongodb|redis)\.(?:conf|config)/i,

  // Server configuration files
  /Cannot HEAD \/(?:nginx|apache|httpd)\.conf/i,
  /Cannot HEAD \/(?:server|application)\.properties/i,

  // Cloud and container configuration
  /Cannot HEAD \/(?:docker-compose|kubernetes|k8s)\.ya?ml/i,
  /Cannot HEAD \/(?:terraform|pulumi)\.(?:tf|yaml)/i,

  // Security and authentication configuration
  /Cannot HEAD \/(?:auth|oauth|jwt)\.(?:json|yml|yaml)/i,
  /Cannot HEAD \/(?:ssl|tls|cert)\.(?:pem|key|crt)/i,

  // Additional information disclosure attempts via HEAD requests
  /Cannot HEAD \/(?:version|build|info)\.(?:txt|json|xml)/i,
  /Cannot HEAD \/(?:readme|changelog|license)\.(?:txt|md)/i,
  /Cannot HEAD \/(?:package|composer)\.(?:json|lock)/i,
  /Cannot HEAD \/(?:yarn|npm)\.lock/i,
  /Cannot HEAD \/(?:requirements|pipfile)\.(?:txt|lock)/i,
  /Cannot HEAD \/(?:gemfile|podfile)\.lock/i,

  // Common backup and temporary file discovery
  /Cannot HEAD \/[^/]*\.(?:bak|backup|old|tmp|swp|orig|save)/i,
  /Cannot HEAD \/[^/]*~$/i, // Vim backup files
  /Cannot HEAD \/\.#[^/]*/i, // Emacs temporary files

  // Source code and development file discovery
  /Cannot HEAD \/(?:src|source|dev|development)\/[^/]*\.(?:js|ts|py|php|java|rb|go)/i,
  /Cannot HEAD \/(?:test|tests|spec)\/[^/]*\.(?:js|ts|py|php|java|rb|go)/i,

  // IDE and editor configuration files
  /Cannot HEAD \/\.(?:vscode|idea|eclipse|sublime)\/[^/]*/i,
  /Cannot HEAD \/\.editorconfig/i,

  // Build and deployment configuration
  /Cannot HEAD \/(?:makefile|dockerfile|vagrantfile|procfile)/i,
  /Cannot HEAD \/(?:jenkins|travis|circle|github)\.ya?ml/i,
  /Cannot HEAD \/\.(?:travis|circleci|github)\/[^/]*/i,

  // Package manager and dependency files
  /Cannot HEAD \/(?:bower|grunt|gulp)\.(?:json|js)/i,
  /Cannot HEAD \/(?:webpack|rollup|vite)\.config\.js/i,

  // Log and monitoring file discovery
  /Cannot HEAD \/(?:logs?|monitoring|metrics)\/[^/]*\.(?:log|txt)/i,
  /Cannot HEAD \/[^/]*\.log$/i,

  // === ADDITIONAL MODERN PATTERNS ===

  // Web3 and blockchain attacks
  /Cannot GET .*(?:wallet|metamask|web3|ethereum|bitcoin|crypto|blockchain)/i,

  // Modern vulnerability scanners
  /Cannot GET .*(?:nuclei|httpx|subfinder|amass|ffuf|gobuster|dirbuster)/i,

  // Cloud provider specific attacks
  /Cannot GET .*(?:gcp|azure|digitalocean|linode|vultr|heroku)/i,

  // Modern monitoring and observability
  /Cannot GET .*(?:grafana|prometheus|jaeger|zipkin|datadog|newrelic)/i,

  // Additional legacy patterns that are still common
  /(?:adminer|aws\/credentials|backup\.tar\.gz|\.bak|\.svn|\.hg)/i,
];
