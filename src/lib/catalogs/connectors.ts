/**
 * Trino connector registry — requirement 2.1 ("katalog tipine göre öneri parametre
 * ve key-value pair listelenmesi"). Each connector lists the properties Trino most
 * commonly needs so the catalog editor can suggest them. Users can still add
 * arbitrary key/value pairs; this is guidance, not a hard schema.
 */

export type ConnectorParam = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** Rendered as a password field and redacted in previews. */
  secret?: boolean;
};

export type ConnectorDef = {
  name: string;
  label: string;
  params: ConnectorParam[];
};

/** Shared JDBC connection params (used by all relational connectors). */
function jdbc(urlPlaceholder: string): ConnectorParam[] {
  return [
    { key: "connection-url", label: "JDBC URL", placeholder: urlPlaceholder, required: true },
    { key: "connection-user", label: "Kullanıcı", placeholder: "kullanıcı adı", required: true },
    { key: "connection-password", label: "Şifre", placeholder: "••••••", secret: true },
  ];
}

export const CONNECTORS: ConnectorDef[] = [
  { name: "postgresql", label: "PostgreSQL", params: jdbc("jdbc:postgresql://host:5432/veritabani") },
  { name: "mysql", label: "MySQL", params: jdbc("jdbc:mysql://host:3306") },
  { name: "sqlserver", label: "SQL Server", params: jdbc("jdbc:sqlserver://host:1433;database=db") },
  { name: "oracle", label: "Oracle", params: jdbc("jdbc:oracle:thin:@host:1521:ORCL") },
  { name: "redshift", label: "Amazon Redshift", params: jdbc("jdbc:redshift://host:5439/db") },
  { name: "clickhouse", label: "ClickHouse", params: jdbc("jdbc:clickhouse://host:8123") },
  {
    name: "hive",
    label: "Hive",
    params: [
      { key: "hive.metastore.uri", label: "Metastore URI", placeholder: "thrift://host:9083", required: true },
      { key: "hive.config.resources", label: "Hadoop config dosyaları", placeholder: "/etc/hadoop/core-site.xml" },
    ],
  },
  {
    name: "iceberg",
    label: "Iceberg",
    params: [
      { key: "iceberg.catalog.type", label: "Katalog tipi", placeholder: "hive_metastore | glue | rest", required: true },
      { key: "hive.metastore.uri", label: "Metastore URI", placeholder: "thrift://host:9083" },
    ],
  },
  {
    name: "mongodb",
    label: "MongoDB",
    params: [
      { key: "mongodb.connection-url", label: "Bağlantı URL", placeholder: "mongodb://host:27017", required: true },
    ],
  },
  {
    name: "bigquery",
    label: "Google BigQuery",
    params: [
      { key: "bigquery.project-id", label: "Proje ID", placeholder: "my-gcp-project", required: true },
      { key: "bigquery.credentials-file", label: "Kimlik dosyası", placeholder: "/etc/trino/bq.json" },
    ],
  },
  { name: "memory", label: "Memory (test)", params: [] },
  { name: "tpch", label: "TPCH (örnek veri)", params: [] },
];

export function getConnector(name: string): ConnectorDef | undefined {
  return CONNECTORS.find((c) => c.name === name);
}

/** Render a catalog `.properties` file (`connector.name=…` + sorted key=value). */
export function toCatalogProperties(connector: string, props: Record<string, string>): string {
  const lines = [`connector.name=${connector}`];
  for (const key of Object.keys(props).sort((a, b) => a.localeCompare(b))) {
    const value = props[key];
    if (value !== undefined && value !== "") lines.push(`${key}=${value}`);
  }
  return `${lines.join("\n")}\n`;
}

/** Parse a catalog `.properties` file back into a connector + props (for rollback). */
export function parseCatalogProperties(text: string): { connector: string; properties: Record<string, string> } {
  let connector = "";
  const properties: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === "connector.name") connector = value;
    else properties[key] = value;
  }
  return { connector, properties };
}
