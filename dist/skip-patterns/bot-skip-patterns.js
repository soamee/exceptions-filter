"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.botSkipPatterns = void 0;
exports.botSkipPatterns = [
    // Boa httpd (embedded IoT/router web server) and Oracle BI Publisher probing
    /^Cannot POST \/boafrm\/formLogin$/i, // Boa httpd login form probing (IoT/router devices)
    /^Cannot POST \/boafrm\/formSysCmd$/i, // Boa httpd system command form probing (RCE attempt)
    /^Cannot POST \/xmlpserver\/ReportTemplateService\.xls$/i, // Oracle BI Publisher XMLP report template service probing
    /^Cannot POST \/-\/jira\/login\/oauth\/access_token$/i, // Atlassian Jira OAuth access token endpoint probing
    /^Cannot POST \/rest\/tinymce\/1\/macro\/preview$/i, // Atlassian Confluence TinyMCE macro preview probing (CVE-2019-3396 template injection)
    /^Cannot POST \/node\/\d+\?_format=hal_json$/i, // Drupal REST/HAL JSON node endpoint probing (CVE-2019-6340 RCE)
    /^Cannot POST \/servlet\/.*$/i, // Java servlet endpoint probing, e.g. UploadServlet (no servlet stack in use)
    /^Cannot POST \/Autodiscover\/Autodiscover\.xml$/i, // Microsoft Exchange Autodiscover endpoint probing
    /^Cannot POST \/CDGServer3\/ClientAjax$/i, // CDGServer3 ClientAjax endpoint probing
    /^Cannot POST \/api\/timelion\/run$/i, // Kibana Timelion run endpoint probing
    /^Cannot POST \/_async\/AsyncResponseService$/i, // Async response service endpoint probing
    /^Cannot POST \/service\/extdirect$/i, // Sencha Ext.Direct / Nexus Repository extdirect probing (CVE-2019-7238)
    // Additional enterprise / appliance probe routes (stacks not present in this API)
    /^Cannot POST \/minio\/webrpc$/i, // MinIO admin webrpc endpoint probing
    /^Cannot POST \/storfs-asup$/i, // Cisco HyperFlex storfs-asup endpoint probing (CVE-2021-1497)
    /^Cannot POST \/upload$/i, // Generic file upload endpoint probing
    /^Cannot POST \/v1\/submissions\/create$/i, // Submissions create endpoint probing
    /^Cannot POST \/eonapi\/createEonUser(?:\?.*)?$/i, // eonapi createEonUser admin-creation endpoint probing
    /^Cannot POST \/uapjs\/jsinvoke\/?(?:\?.*)?$/i, // Yonyou UAP jsinvoke endpoint probing (RCE)
    /^Cannot POST \/EemAdminService\/EemAdmin$/i, // EemAdminService admin endpoint probing
    /^Cannot POST \/CTCWebService\/CTCWebServiceBean\/ConfigServlet$/i, // SAP NetWeaver CTC ConfigServlet endpoint probing
    /^Cannot POST \/api\/jsonws\/invoke$/i, // Liferay JSON web services invoke endpoint probing (CVE-2020-7961)
    /^Cannot POST \/cgi$/i, // Generic CGI endpoint probing
    /^Cannot POST \/(?:meaweb\/)?os\/mxperson$/i, // IBM Maximo os/mxperson endpoint probing (optional meaweb prefix)
    /^Cannot POST \/dfsms\/?$/i, // dfsms endpoint probing
    // Deserialization / JSON-RPC probes, WebLogic ws_utc, Artifactory/UI auth and collector probing
    /^Cannot POST \/parse$/i, // Parse Server / generic parse endpoint probing
    /^Cannot POST \/deserialize$/i, // Deserialization endpoint probing (RCE attempt)
    /^Cannot POST \/json$/i, // Generic JSON endpoint probing
    /^Cannot POST \/api\/json$/i, // Generic API JSON endpoint probing
    /^Cannot POST \/com\.example\.TestService$/i, // Java sample servlet probing
    /^Cannot POST \/ws_utc\/.*$/i, // Oracle WebLogic ws_utc console probing (setting/options, setting/keystore; CVE-2018-2894)
    /^Cannot POST \/(?:artifactory\/)?ui\/auth\/login(?:\?.*)?$/i, // (JFrog Artifactory) UI auth login probing, optional query (e.g. _spring_security_remember_me)
    /^Cannot POST \/admin\/\?.*doExportPack/i, // CMS admin language export-pack probing (RCE attempt)
    /^Cannot POST \/Collector\/appliancesettings\/applianceSettingsFileTransfer$/i, // Enterprise collector appliance settings file transfer probing
    // CMS / legacy-site directory probing and enterprise collector/plugin RCE probes
    /^Cannot GET \/old$/i, // Legacy /old directory scanning
    /^Cannot GET \/newsite$/i, // Legacy /newsite directory scanning
    /^Cannot GET \/new$/i, // /new directory scanning
    /^Cannot GET \/wordpress$/i, // WordPress install directory scanning
    /^Cannot GET \/wp$/i, // WordPress short-path directory scanning
    /^Cannot GET \/blog$/i, // Blog directory scanning
    /^Cannot POST \/admin\/\?.*doExportPack/i, // CMS admin language export-pack probing (RCE attempt)
    /^Cannot POST \/crowd\/admin\/uploadplugin\.action$/i, // Atlassian Crowd plugin upload probing (CVE-2019-11580)
    /^Cannot POST \/Collector\/diagnostics\/trace_route$/i, // Enterprise collector diagnostics trace_route probing
    /^Cannot POST \/Collector\/diagnostics\/ping$/i, // Enterprise collector diagnostics ping probing
    // Java / enterprise servlet, JSP and RPC endpoint probing
    // (this API runs no JSP, Apache OFBiz, or Java servlet stack, so these are always bot noise)
    /^Cannot POST \/api\/session$/i, // Session endpoint probing
    /^Cannot POST \/webtools\/control\/httpService$/i, // Apache OFBiz webtools httpService probing
    /^Cannot POST \/webtools\/control\/xmlrpc$/i, // Apache OFBiz webtools XML-RPC probing
    /^Cannot POST \/invoker\/JMXInvokerServlet(?:\/.*)?$/i, // JBoss JMX invoker servlet probing
    /^Cannot POST \/axis2\/axis2-admin\/login$/i, // Apache Axis2 admin login probing
    /^Cannot POST \/bsh\.servlet\.BshServlet$/i, // BeanShell servlet remote-code-execution probing
    /^Cannot POST \/webadm\/.*$/i, // Web admin dashboard probing (e.g. moni_detail.do)
    /^Cannot POST \/weaver\/.*$/i, // Weaver e-office / Apache XML-RPC servlet probing
    /^Cannot POST \/cgibin\/webproc$/i, // Network device cgibin webproc probing
    /^Cannot (?:POST|GET|PUT|DELETE|PATCH|OPTIONS|HEAD) \/.*\.jsp(?:[/?].*)?$/i, // JSP endpoint probing (no JSP stack in use)
    /^Cannot (?:POST|GET|PUT|DELETE|PATCH|OPTIONS|HEAD) \/.*\.xhtml(?:[/?].*)?$/i, // JSF / XHTML (javax.faces.resource) endpoint probing
    /^Cannot POST \/$/i, // Bots posting to root
    /^Cannot DELETE \/$/i, // Bots attempting to delete root
    /^Cannot POST \/sdk$/i, // Probing for SDK endpoint
    /^Cannot POST \/json_rpc$/i, // JSON-RPC endpoint probing
    /^Cannot POST \/admin$/i, // Attempt to reach admin panel
    /^Cannot POST \/login$/i, // Brute force login attempts
    /^Cannot POST \/session$/i, // Session endpoint probing
    /^Cannot POST \/api\/auth\/login$/i, // Unauthorized login route probing
    /^Cannot POST \/api$/i, // Incorrect API root method
    /^Cannot POST \/app$/i, // Incorrect app root method
    /^Cannot POST \/resolve$/i, // Invalid resolve route probing
    /^Cannot POST \/resolve(\/.*|\?.*)?$/i, // Invalid resolve route variations
    /wp-login\.php/i, // WordPress login scanning
    /wp-admin/i, // WordPress admin scanning
    /xmlrpc\.php/i, // WordPress XML-RPC attacks
    /phpmyadmin/i, // phpMyAdmin enumeration
    /\.env/i, // Accessing environment files
    /\.git/i, // Trying to read Git repository
    /etc\/passwd/i, // Attempting to read system passwd file
    /vendor\/phpunit/i, // PHPUnit exposure
    /manager\/html/i, // Tomcat manager enumeration
    /solr/i, // Apache Solr admin scanning
    /cgi-bin/i, // Generic CGI probing
    /actuator/i, // Spring Boot actuator scanning
    /wp-includes/i, // WordPress includes directory
    /wp-content/i, // WordPress content directory
    /wp-json/i, // WordPress REST API enumeration
    /^Cannot GET \/wp-json(?:\/.*)?$/i, // WordPress REST API route probing
    /robots\.txt/i, // Robots file enumeration
    /sitemap\.xml/i, // Sitemap enumeration
    /ads\.txt/i, // Ads configuration enumeration
    /\.htaccess/i, // Apache configuration file
    /config\.php/i, // PHP configuration file
    /setup\.php/i, // Setup script probing
    /install\.php/i, // Install script probing
    /phpinfo\.php/i, // phpinfo exposure
    /admin\.php/i, // Admin script enumeration
    /login\.php/i, // Login script enumeration
    /status\.php/i, // PHP status page probing
    /owncloud/i, // OwnCloud installation scanning
    /shell/i, // Shell or web shell attempts
    /_next/i, // Next.js internal folder
    /\.well-known/i, // Well-known resources scanning
    /^Cannot GET \/\.well-known\/security\.txt$/i, // Security.txt file scanning
    /_profiler/i, // Symfony profiler
    /\.DS_Store/i, // macOS metadata files
    /HNAP1/i, // HNAP protocol probing
    /hudson\/login/i, // Jenkins (Hudson) login
    /\.ssh/i, // Attempt to access SSH directory
    /id_rsa/i, // Attempt to read private SSH key
    /server-status/i, // Apache server-status page
    /^Cannot POST \/global-protect\/login\.esp$/i, // GlobalProtect probing attempts
    /^Cannot POST \/remote\/logincheck$/i, // Remote login probing
    /^Cannot POST \/onvif\/device_service$/i, // ONVIF device service probing
    /^Cannot POST \/hello\.world/i, // Invalid route testing
    /^Cannot POST \/dns/i, // DNS probing
    /^Cannot POST \/query$/i, // Query endpoint probing
    /^Cannot POST \/mcp(?:\/.*|\?.*)?$/i, // MCP endpoint probing
    /^Cannot (?:POST|GET) \/(?:api\/)?ai(?:\/.*)?$/i, // Generic AI endpoint probing
    /^Cannot POST \/(?:api\/)?(?:openai|anthropic|chatgpt|llm)(?:\/.*)?$/i, // AI provider route probing
    /^Cannot POST \/update_weights_from_tensor$/i, // Tensor model update probing
    /^Cannot POST \/sdk\/$/i, // SDK directory probing
    /^Cannot POST \/auth\/check$/i, // Auth check endpoint probing
    /^Cannot POST \/goform\/setSysAdm$/i, // Router admin panel exploit (goform)
    /^Cannot POST \/auth\/newpassword$/i, // Password reset endpoint probing
    /^Cannot POST \/convert$/i, // Convert endpoint probing
    /^Cannot POST \/login\.htm$/i, // Login page POST probing
    /^Cannot POST \/service\/v1\/createUser$/i, // User creation service probing
    /^Cannot POST \/SearchSvc\/CVSearchService\.svc$/i, // Commvault search service probing
    /^Cannot POST \/var$/i, // Var directory probing
    /^Cannot POST \/carbon\/generic\/save_artifact_ajaxprocessor\.jsp$/i, // WSO2 Carbon artifact processor exploit
    /^Cannot POST \/checkValid$/i, // Validation check endpoint probing
    /^Cannot POST \/update_[a-z_]+_from_tensor$/i, // Similar tensor update probing variants
    /^Cannot POST \/(?:api\/)?(?:tensor|tensors|model)\/(?:update|upload|weights?)(?:\/.*)?$/i, // Tensor and model update/upload probing
    /^Cannot POST \/wsman$/i, // Windows remote management probing
    /^Cannot POST \/scripts\//i, // Generic POST attempts to scripts directory
    /^Cannot PUT \/testing-put\.txt$/i, // Testing PUT file attack attempt
    /^Cannot POST \/ajax$/i, // AJAX endpoint probing
    /^Cannot POST \/api\/v1\/validate\/code$/i, // Invalid POST to validation endpoint
    /^Cannot PROPFIND \/$/i, // WebDAV PROPFIND root probing
    /^Cannot PROPFIND \/.*$/i, // Matches any "Cannot PROPFIND /<route>"
    /^Cannot POST \/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, // Random UUID route enumeration
    /^Cannot POST \/adminPage\/remote\/cmdOver$/i, // Admin page remote command probing
    /^Cannot POST \/dataSetParam\/verification;swagger-ui\/$/i, // Dataset parameter verification with swagger UI probing
    /^Cannot POST \/api\/tokens$/i, // API tokens endpoint probing
    /^Cannot HEAD \/$/i, // HEAD request to root endpoint
    /^Cannot HEAD \/_ignition\/execute-solution$/i, // Laravel Ignition execute-solution probe
    /^Cannot HEAD \/WORDPRESS$/i, // HEAD request to WordPress directory (case-insensitive)
    /^Cannot HEAD \/wp$/i, // HEAD request to wp directory (case-insensitive)
    // Enterprise application login pages and admin consoles
    /^Cannot GET \/api\/session\/properties$/i, // API session properties endpoint probing
    /^Cannot GET \/ssi\.cgi\/Login\.htm$/i, // SSI CGI login page (network devices)
    /^Cannot GET \/cgi-bin\/authLogin\.cgi$/i, // CGI authentication login (network devices)
    /^Cannot GET \/OA_HTML\/AppsLocalLogin\.jsp$/i, // Oracle E-Business Suite login page
    /^Cannot GET \/helpdesk\/WebObjects\/Helpdesk\.woa$/i, // Helpdesk WebObjects application
    /^Cannot GET \/partymgr\/control\/main$/i, // Apache OFBiz Party Manager main control
    /^Cannot GET \/login\.do$/i, // Generic Java Struts login action
    /^Cannot GET \/jasperserverTest\/login\.html$/i, // JasperServer test environment login
    /^Cannot GET \/jasperserver-pro\/login\.html$/i, // JasperServer Pro login page
    /^Cannot GET \/jasperserver\/login\.html$/i, // JasperServer login page
    /^Cannot GET \/login\.html$/i, // Generic HTML login page
    /^Cannot GET \/php\/login\.php$/i, // PHP login page in subdirectory
    /^Cannot GET \/index\.jsp$/i, // Generic JSP index page
    /^Cannot GET \/showLogin\.cc$/i, // Show login page (CC extension)
    /^Cannot GET \/console$/i, // Generic admin console access
    /^Cannot GET \/identity$/i, // Identity service endpoint probing
    /^Cannot GET \/internal_forms_authentication$/i, // Internal forms authentication endpoint
    /^Cannot GET \/WebInterface\/$/i, // Web interface directory (network devices, cameras)
    /^Cannot GET \/xmldata\?item=all$/i, // XML data endpoint probing (network devices)
    /^Cannot GET \/webfig\/$/i, // MikroTik RouterOS WebFig interface
    /^Cannot GET \/aspera\/faspex\/$/i, // IBM Aspera Faspex file transfer application
    /^Cannot GET \/zabbix\/favicon\.ico$/i, // Zabbix monitoring system favicon
    /^Cannot GET \/sugar_version\.json$/i, // SugarCRM version information file
    /^Cannot GET \/Telerik\.Web\.UI\.WebResource\.axd\?type=rau$/i, // Telerik Web UI resource handler (file upload vulnerability scanning)
    // Static assets and web application resources
    /^Cannot GET \/license\.txt$/i, // License text file exposure
    /^Cannot GET \/ext-js\/app\/common\/zld_product_spec\.js$/i, // ExtJS application specification file
    /^Cannot GET \/cf_scripts\/scripts\/ajax\/ckeditor\/ckeditor\.js$/i, // ColdFusion CKEditor script
    /^Cannot GET \/css\/images\/PTZOptics_powerby\.png$/i, // PTZOptics branding image (camera systems)
    /^Cannot GET \/static\/historypage\.js$/i, // Static history page JavaScript file
    // Configuration and sensitive file access attempts
    /^Cannot GET \/api\/config\.js$/i, // API configuration file exposure
    /^Cannot GET \/api\/objects\/codes\.php$/i, // API object codes PHP file access
    /^Cannot GET \/admin\/controllers\/partner\.js$/i, // Admin controller file exposure
    /^Cannot GET \/backend\/config$/i, // Backend configuration access
    /^Cannot GET \/backend\/config\/development\.yml$/i, // Backend development configuration YAML file
    /^Cannot GET \/backend\/config\/default\.yml$/i, // Backend default configuration YAML file
    /^Cannot GET \/config\/application\.yml$/i, // Application configuration YAML file
    /^Cannot GET \/config\/local\.yml$/i, // Local configuration YAML file
    /^Cannot GET \/config\/constants\.js$/i, // Configuration constants file
    /^Cannot GET \/cloud\/Scraper\.js$/i, // Cloud scraper script exposure
    /^Cannot GET \/configs\/routes\.js$/i, // Routes configuration file
    /^Cannot GET \/configs\/routes-4aug\.js$/i, // Versioned routes configuration file
    /^Cannot GET \/app\.js$/i, // Main application file access
    /^Cannot GET \/app\.py$/i, // Main Python application file access
    /^Cannot GET \/main\.js$/i, // Main JavaScript file access
    /^Cannot GET \/main\.yml$/i, // Main YAML configuration file
    /^Cannot GET \/server\.js$/i, // Server JavaScript file access
    /^Cannot GET \/configs\/s3_config\.json$/i, // S3 configuration file with potential AWS credentials
    /^Cannot GET \/controller\/admin\/post\.js$/i, // Admin post controller file
    /^Cannot GET \/controller\/api\/post\.js$/i, // API post controller file
    /^Cannot GET \/apis\/config\/config\.js$/i, // API configuration file access
    /^Cannot GET \/apis\/controllers\/users\.js$/i, // User controller file exposure
    /^Cannot GET \/user\/controllers\/index\.js$/i, // User controllers index file
    /^Cannot GET \/getcpuutil\.php-bakworking$/i, // CPU utility PHP backup file access
    /^Cannot GET \/controllers\/settings\.js$/i, // Settings controller file
    /^Cannot GET \/helper\.js$/i, // Helper utility file access
    /^Cannot GET \/helpers\/utility\.js$/i, // Helpers utility file access
    /^Cannot GET \/config\/settings\.json$/i, // Settings configuration JSON file
    /^Cannot GET \/app\/config\/parameters\.yml$/i, // Application parameters configuration
    /^Cannot GET \/config\/settings\.prod$/i, // Production settings configuration
    /^Cannot GET \/partner\/config\/config\.js$/i, // Partner configuration file
    /^Cannot GET \/sms\.py$/i, // SMS utility Python script
    /^Cannot GET \/helper\/EmailHelper\.js$/i, // Email helper utility file
    /^Cannot GET \/wp-config$/i, // WordPress configuration file access
    // Environment and development files (security sensitive)
    /^Cannot GET \/my_env\/.*$/i, // Python virtual environment files (may contain secrets)
    /^Cannot GET \/mytest\/.*$/i, // Test environment files (may contain test secrets)
    /^Cannot GET \/\.circleci\/.*$/i, // CircleCI configuration files (may contain deployment keys)
    /^Cannot GET \/\.travis\.yml$/i, // Travis CI configuration file (may contain deployment keys)
    /.*\.env$/i, // Environment files containing secrets and configuration
    // Microsoft Exchange and enterprise systems
    /^Cannot GET \/owa\/$/i, // Microsoft Exchange OWA (Outlook Web Access) directory
    /^Cannot GET \/owa\/auth\/logon\.aspx$/i, // Microsoft Exchange OWA (Outlook Web Access) login page probing
    // Specific POST upload/probe routes to skip noisy bot scans
    /^Cannot POST \/admin\/media$/i,
    /^Cannot POST \/api\/products\/images$/i,
    /^Cannot POST \/api\/files$/i,
    /^Cannot POST \/api\/attachments$/i,
    /^Cannot POST \/api\/v1\/documents$/i,
    /^Cannot POST \/api\/content\/upload$/i,
    /^Cannot POST \/api\/assets$/i,
    /^Cannot POST \/api\/assets\/upload$/i,
    /^Cannot POST \/admin\/upload$/i,
    /^Cannot POST \/admin\/files$/i,
    /^Cannot POST \/form(?:\/.*)?$/i, // Matches any "Cannot POST /form..." probe route
    /^Cannot (?:POST|GET|PUT|DELETE|PATCH|OPTIONS|HEAD) \/.*\.php(?:[/?].*)?$/i, // PHP endpoint probing (e.g., PHPUnit eval-stdin.php)
    /^Cannot (?:POST|GET|PUT|DELETE|PATCH|OPTIONS|HEAD) \/.*\.cgi(?:[/?].*)?$/i, // CGI endpoint probing (e.g., /update/picture.cgi)
    /^Cannot GET \/.*$/i, // Matches any "Cannot GET /<route>"
];
