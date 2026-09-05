var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// scripts/seed-catalog.ts
import crypto2 from "node:crypto";
import dotenv from "dotenv";

// node_modules/drizzle-orm/entity.js
var entityKind = Symbol.for("drizzle:entityKind");
var hasOwnEntityKind = Symbol.for("drizzle:hasOwnEntityKind");
function is(value, type) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value instanceof type) {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
    throw new Error(
      `Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`
    );
  }
  let cls = Object.getPrototypeOf(value).constructor;
  if (cls) {
    while (cls) {
      if (entityKind in cls && cls[entityKind] === type[entityKind]) {
        return true;
      }
      cls = Object.getPrototypeOf(cls);
    }
  }
  return false;
}

// node_modules/drizzle-orm/column.js
var Column = class {
  constructor(table, config) {
    this.table = table;
    this.config = config;
    this.name = config.name;
    this.keyAsName = config.keyAsName;
    this.notNull = config.notNull;
    this.default = config.default;
    this.defaultFn = config.defaultFn;
    this.onUpdateFn = config.onUpdateFn;
    this.hasDefault = config.hasDefault;
    this.primary = config.primaryKey;
    this.isUnique = config.isUnique;
    this.uniqueName = config.uniqueName;
    this.uniqueType = config.uniqueType;
    this.dataType = config.dataType;
    this.columnType = config.columnType;
    this.generated = config.generated;
    this.generatedIdentity = config.generatedIdentity;
  }
  static [entityKind] = "Column";
  name;
  keyAsName;
  primary;
  notNull;
  default;
  defaultFn;
  onUpdateFn;
  hasDefault;
  isUnique;
  uniqueName;
  uniqueType;
  dataType;
  columnType;
  enumValues = void 0;
  generated = void 0;
  generatedIdentity = void 0;
  config;
  mapFromDriverValue(value) {
    return value;
  }
  mapToDriverValue(value) {
    return value;
  }
  // ** @internal */
  shouldDisableInsert() {
    return this.config.generated !== void 0 && this.config.generated.type !== "byDefault";
  }
};

// node_modules/drizzle-orm/column-builder.js
var ColumnBuilder = class {
  static [entityKind] = "ColumnBuilder";
  config;
  constructor(name, dataType, columnType) {
    this.config = {
      name,
      keyAsName: name === "",
      notNull: false,
      default: void 0,
      hasDefault: false,
      primaryKey: false,
      isUnique: false,
      uniqueName: void 0,
      uniqueType: void 0,
      dataType,
      columnType,
      generated: void 0
    };
  }
  /**
   * Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
   *
   * @example
   * ```ts
   * const users = pgTable('users', {
   * 	id: integer('id').$type<UserId>().primaryKey(),
   * 	details: json('details').$type<UserDetails>().notNull(),
   * });
   * ```
   */
  $type() {
    return this;
  }
  /**
   * Adds a `not null` clause to the column definition.
   *
   * Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
   */
  notNull() {
    this.config.notNull = true;
    return this;
  }
  /**
   * Adds a `default <value>` clause to the column definition.
   *
   * Affects the `insert` model of the table - columns *with* `default` are optional on insert.
   *
   * If you need to set a dynamic default value, use {@link $defaultFn} instead.
   */
  default(value) {
    this.config.default = value;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Adds a dynamic default value to the column.
   * The function will be called when the row is inserted, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $defaultFn(fn) {
    this.config.defaultFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $defaultFn}.
   */
  $default = this.$defaultFn;
  /**
   * Adds a dynamic update value to the column.
   * The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
   * If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $onUpdateFn(fn) {
    this.config.onUpdateFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $onUpdateFn}.
   */
  $onUpdate = this.$onUpdateFn;
  /**
   * Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
   *
   * In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
   */
  primaryKey() {
    this.config.primaryKey = true;
    this.config.notNull = true;
    return this;
  }
  /** @internal Sets the name of the column to the key within the table definition if a name was not given. */
  setName(name) {
    if (this.config.name !== "") return;
    this.config.name = name;
  }
};

// node_modules/drizzle-orm/table.utils.js
var TableName = Symbol.for("drizzle:Name");

// node_modules/drizzle-orm/pg-core/foreign-keys.js
var ForeignKeyBuilder = class {
  static [entityKind] = "PgForeignKeyBuilder";
  /** @internal */
  reference;
  /** @internal */
  _onUpdate = "no action";
  /** @internal */
  _onDelete = "no action";
  constructor(config, actions) {
    this.reference = () => {
      const { name, columns, foreignColumns } = config();
      return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
    };
    if (actions) {
      this._onUpdate = actions.onUpdate;
      this._onDelete = actions.onDelete;
    }
  }
  onUpdate(action) {
    this._onUpdate = action === void 0 ? "no action" : action;
    return this;
  }
  onDelete(action) {
    this._onDelete = action === void 0 ? "no action" : action;
    return this;
  }
  /** @internal */
  build(table) {
    return new ForeignKey(table, this);
  }
};
var ForeignKey = class {
  constructor(table, builder) {
    this.table = table;
    this.reference = builder.reference;
    this.onUpdate = builder._onUpdate;
    this.onDelete = builder._onDelete;
  }
  static [entityKind] = "PgForeignKey";
  reference;
  onUpdate;
  onDelete;
  getName() {
    const { name, columns, foreignColumns } = this.reference();
    const columnNames = columns.map((column) => column.name);
    const foreignColumnNames = foreignColumns.map((column) => column.name);
    const chunks = [
      this.table[TableName],
      ...columnNames,
      foreignColumns[0].table[TableName],
      ...foreignColumnNames
    ];
    return name ?? `${chunks.join("_")}_fk`;
  }
};

// node_modules/drizzle-orm/tracing-utils.js
function iife(fn, ...args) {
  return fn(...args);
}

// node_modules/drizzle-orm/pg-core/unique-constraint.js
function uniqueKeyName(table, columns) {
  return `${table[TableName]}_${columns.join("_")}_unique`;
}
var UniqueConstraintBuilder = class {
  constructor(columns, name) {
    this.name = name;
    this.columns = columns;
  }
  static [entityKind] = "PgUniqueConstraintBuilder";
  /** @internal */
  columns;
  /** @internal */
  nullsNotDistinctConfig = false;
  nullsNotDistinct() {
    this.nullsNotDistinctConfig = true;
    return this;
  }
  /** @internal */
  build(table) {
    return new UniqueConstraint(table, this.columns, this.nullsNotDistinctConfig, this.name);
  }
};
var UniqueOnConstraintBuilder = class {
  static [entityKind] = "PgUniqueOnConstraintBuilder";
  /** @internal */
  name;
  constructor(name) {
    this.name = name;
  }
  on(...columns) {
    return new UniqueConstraintBuilder(columns, this.name);
  }
};
var UniqueConstraint = class {
  constructor(table, columns, nullsNotDistinct, name) {
    this.table = table;
    this.columns = columns;
    this.name = name ?? uniqueKeyName(this.table, this.columns.map((column) => column.name));
    this.nullsNotDistinct = nullsNotDistinct;
  }
  static [entityKind] = "PgUniqueConstraint";
  columns;
  name;
  nullsNotDistinct = false;
  getName() {
    return this.name;
  }
};

// node_modules/drizzle-orm/pg-core/utils/array.js
function parsePgArrayValue(arrayString, startFrom, inQuotes) {
  for (let i = startFrom; i < arrayString.length; i++) {
    const char2 = arrayString[i];
    if (char2 === "\\") {
      i++;
      continue;
    }
    if (char2 === '"') {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i + 1];
    }
    if (inQuotes) {
      continue;
    }
    if (char2 === "," || char2 === "}") {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i];
    }
  }
  return [arrayString.slice(startFrom).replace(/\\/g, ""), arrayString.length];
}
function parsePgNestedArray(arrayString, startFrom = 0) {
  const result = [];
  let i = startFrom;
  let lastCharIsComma = false;
  while (i < arrayString.length) {
    const char2 = arrayString[i];
    if (char2 === ",") {
      if (lastCharIsComma || i === startFrom) {
        result.push("");
      }
      lastCharIsComma = true;
      i++;
      continue;
    }
    lastCharIsComma = false;
    if (char2 === "\\") {
      i += 2;
      continue;
    }
    if (char2 === '"') {
      const [value2, startFrom2] = parsePgArrayValue(arrayString, i + 1, true);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    if (char2 === "}") {
      return [result, i + 1];
    }
    if (char2 === "{") {
      const [value2, startFrom2] = parsePgNestedArray(arrayString, i + 1);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    const [value, newStartFrom] = parsePgArrayValue(arrayString, i, false);
    result.push(value);
    i = newStartFrom;
  }
  return [result, i];
}
function parsePgArray(arrayString) {
  const [result] = parsePgNestedArray(arrayString, 1);
  return result;
}
function makePgArray(array) {
  return `{${array.map((item) => {
    if (Array.isArray(item)) {
      return makePgArray(item);
    }
    if (typeof item === "string") {
      return `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return `${item}`;
  }).join(",")}}`;
}

// node_modules/drizzle-orm/pg-core/columns/common.js
var PgColumnBuilder = class extends ColumnBuilder {
  foreignKeyConfigs = [];
  static [entityKind] = "PgColumnBuilder";
  array(size) {
    return new PgArrayBuilder(this.config.name, this, size);
  }
  references(ref, actions = {}) {
    this.foreignKeyConfigs.push({ ref, actions });
    return this;
  }
  unique(name, config) {
    this.config.isUnique = true;
    this.config.uniqueName = name;
    this.config.uniqueType = config?.nulls;
    return this;
  }
  generatedAlwaysAs(as) {
    this.config.generated = {
      as,
      type: "always",
      mode: "stored"
    };
    return this;
  }
  /** @internal */
  buildForeignKeys(column, table) {
    return this.foreignKeyConfigs.map(({ ref, actions }) => {
      return iife(
        (ref2, actions2) => {
          const builder = new ForeignKeyBuilder(() => {
            const foreignColumn = ref2();
            return { columns: [column], foreignColumns: [foreignColumn] };
          });
          if (actions2.onUpdate) {
            builder.onUpdate(actions2.onUpdate);
          }
          if (actions2.onDelete) {
            builder.onDelete(actions2.onDelete);
          }
          return builder.build(table);
        },
        ref,
        actions
      );
    });
  }
  /** @internal */
  buildExtraConfigColumn(table) {
    return new ExtraConfigColumn(table, this.config);
  }
};
var PgColumn = class extends Column {
  constructor(table, config) {
    if (!config.uniqueName) {
      config.uniqueName = uniqueKeyName(table, [config.name]);
    }
    super(table, config);
    this.table = table;
  }
  static [entityKind] = "PgColumn";
};
var ExtraConfigColumn = class extends PgColumn {
  static [entityKind] = "ExtraConfigColumn";
  getSQLType() {
    return this.getSQLType();
  }
  indexConfig = {
    order: this.config.order ?? "asc",
    nulls: this.config.nulls ?? "last",
    opClass: this.config.opClass
  };
  defaultConfig = {
    order: "asc",
    nulls: "last",
    opClass: void 0
  };
  asc() {
    this.indexConfig.order = "asc";
    return this;
  }
  desc() {
    this.indexConfig.order = "desc";
    return this;
  }
  nullsFirst() {
    this.indexConfig.nulls = "first";
    return this;
  }
  nullsLast() {
    this.indexConfig.nulls = "last";
    return this;
  }
  /**
   * ### PostgreSQL documentation quote
   *
   * > An operator class with optional parameters can be specified for each column of an index.
   * The operator class identifies the operators to be used by the index for that column.
   * For example, a B-tree index on four-byte integers would use the int4_ops class;
   * this operator class includes comparison functions for four-byte integers.
   * In practice the default operator class for the column's data type is usually sufficient.
   * The main point of having operator classes is that for some data types, there could be more than one meaningful ordering.
   * For example, we might want to sort a complex-number data type either by absolute value or by real part.
   * We could do this by defining two operator classes for the data type and then selecting the proper class when creating an index.
   * More information about operator classes check:
   *
   * ### Useful links
   * https://www.postgresql.org/docs/current/sql-createindex.html
   *
   * https://www.postgresql.org/docs/current/indexes-opclass.html
   *
   * https://www.postgresql.org/docs/current/xindex.html
   *
   * ### Additional types
   * If you have the `pg_vector` extension installed in your database, you can use the
   * `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops`, `vector_l1_ops`, `bit_hamming_ops`, `bit_jaccard_ops`, `halfvec_l2_ops`, `sparsevec_l2_ops` options, which are predefined types.
   *
   * **You can always specify any string you want in the operator class, in case Drizzle doesn't have it natively in its types**
   *
   * @param opClass
   * @returns
   */
  op(opClass) {
    this.indexConfig.opClass = opClass;
    return this;
  }
};
var IndexedColumn = class {
  static [entityKind] = "IndexedColumn";
  constructor(name, keyAsName, type, indexConfig) {
    this.name = name;
    this.keyAsName = keyAsName;
    this.type = type;
    this.indexConfig = indexConfig;
  }
  name;
  keyAsName;
  type;
  indexConfig;
};
var PgArrayBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgArrayBuilder";
  constructor(name, baseBuilder, size) {
    super(name, "array", "PgArray");
    this.config.baseBuilder = baseBuilder;
    this.config.size = size;
  }
  /** @internal */
  build(table) {
    const baseColumn = this.config.baseBuilder.build(table);
    return new PgArray(
      table,
      this.config,
      baseColumn
    );
  }
};
var PgArray = class _PgArray extends PgColumn {
  constructor(table, config, baseColumn, range) {
    super(table, config);
    this.baseColumn = baseColumn;
    this.range = range;
    this.size = config.size;
  }
  size;
  static [entityKind] = "PgArray";
  getSQLType() {
    return `${this.baseColumn.getSQLType()}[${typeof this.size === "number" ? this.size : ""}]`;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      value = parsePgArray(value);
    }
    return value.map((v) => this.baseColumn.mapFromDriverValue(v));
  }
  mapToDriverValue(value, isNestedArray = false) {
    const a = value.map(
      (v) => v === null ? null : is(this.baseColumn, _PgArray) ? this.baseColumn.mapToDriverValue(v, true) : this.baseColumn.mapToDriverValue(v)
    );
    if (isNestedArray) return a;
    return makePgArray(a);
  }
};

// node_modules/drizzle-orm/pg-core/columns/enum.js
var PgEnumObjectColumnBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgEnumObjectColumnBuilder";
  constructor(name, enumInstance) {
    super(name, "string", "PgEnumObjectColumn");
    this.config.enum = enumInstance;
  }
  /** @internal */
  build(table) {
    return new PgEnumObjectColumn(
      table,
      this.config
    );
  }
};
var PgEnumObjectColumn = class extends PgColumn {
  static [entityKind] = "PgEnumObjectColumn";
  enum;
  enumValues = this.config.enum.enumValues;
  constructor(table, config) {
    super(table, config);
    this.enum = config.enum;
  }
  getSQLType() {
    return this.enum.enumName;
  }
};
var isPgEnumSym = Symbol.for("drizzle:isPgEnum");
function isPgEnum(obj) {
  return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
var PgEnumColumnBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgEnumColumnBuilder";
  constructor(name, enumInstance) {
    super(name, "string", "PgEnumColumn");
    this.config.enum = enumInstance;
  }
  /** @internal */
  build(table) {
    return new PgEnumColumn(
      table,
      this.config
    );
  }
};
var PgEnumColumn = class extends PgColumn {
  static [entityKind] = "PgEnumColumn";
  enum = this.config.enum;
  enumValues = this.config.enum.enumValues;
  constructor(table, config) {
    super(table, config);
    this.enum = config.enum;
  }
  getSQLType() {
    return this.enum.enumName;
  }
};
function pgEnum(enumName, input) {
  return Array.isArray(input) ? pgEnumWithSchema(enumName, [...input], void 0) : pgEnumObjectWithSchema(enumName, input, void 0);
}
function pgEnumWithSchema(enumName, values, schema2) {
  const enumInstance = Object.assign(
    (name) => new PgEnumColumnBuilder(name ?? "", enumInstance),
    {
      enumName,
      enumValues: values,
      schema: schema2,
      [isPgEnumSym]: true
    }
  );
  return enumInstance;
}
function pgEnumObjectWithSchema(enumName, values, schema2) {
  const enumInstance = Object.assign(
    (name) => new PgEnumObjectColumnBuilder(name ?? "", enumInstance),
    {
      enumName,
      enumValues: Object.values(values),
      schema: schema2,
      [isPgEnumSym]: true
    }
  );
  return enumInstance;
}

// node_modules/drizzle-orm/subquery.js
var Subquery = class {
  static [entityKind] = "Subquery";
  constructor(sql2, fields, alias, isWith = false, usedTables = []) {
    this._ = {
      brand: "Subquery",
      sql: sql2,
      selectedFields: fields,
      alias,
      isWith,
      usedTables
    };
  }
  // getSQL(): SQL<unknown> {
  // 	return new SQL([this]);
  // }
};
var WithSubquery = class extends Subquery {
  static [entityKind] = "WithSubquery";
};

// node_modules/drizzle-orm/version.js
var version = "0.45.2";

// node_modules/drizzle-orm/tracing.js
var otel;
var rawTracer;
var tracer = {
  startActiveSpan(name, fn) {
    if (!otel) {
      return fn();
    }
    if (!rawTracer) {
      rawTracer = otel.trace.getTracer("drizzle-orm", version);
    }
    return iife(
      (otel2, rawTracer2) => rawTracer2.startActiveSpan(
        name,
        (span) => {
          try {
            return fn(span);
          } catch (e) {
            span.setStatus({
              code: otel2.SpanStatusCode.ERROR,
              message: e instanceof Error ? e.message : "Unknown error"
              // eslint-disable-line no-instanceof/no-instanceof
            });
            throw e;
          } finally {
            span.end();
          }
        }
      ),
      otel,
      rawTracer
    );
  }
};

// node_modules/drizzle-orm/view-common.js
var ViewBaseConfig = Symbol.for("drizzle:ViewBaseConfig");

// node_modules/drizzle-orm/table.js
var Schema = Symbol.for("drizzle:Schema");
var Columns = Symbol.for("drizzle:Columns");
var ExtraConfigColumns = Symbol.for("drizzle:ExtraConfigColumns");
var OriginalName = Symbol.for("drizzle:OriginalName");
var BaseName = Symbol.for("drizzle:BaseName");
var IsAlias = Symbol.for("drizzle:IsAlias");
var ExtraConfigBuilder = Symbol.for("drizzle:ExtraConfigBuilder");
var IsDrizzleTable = Symbol.for("drizzle:IsDrizzleTable");
var Table = class {
  static [entityKind] = "Table";
  /** @internal */
  static Symbol = {
    Name: TableName,
    Schema,
    OriginalName,
    Columns,
    ExtraConfigColumns,
    BaseName,
    IsAlias,
    ExtraConfigBuilder
  };
  /**
   * @internal
   * Can be changed if the table is aliased.
   */
  [TableName];
  /**
   * @internal
   * Used to store the original name of the table, before any aliasing.
   */
  [OriginalName];
  /** @internal */
  [Schema];
  /** @internal */
  [Columns];
  /** @internal */
  [ExtraConfigColumns];
  /**
   *  @internal
   * Used to store the table name before the transformation via the `tableCreator` functions.
   */
  [BaseName];
  /** @internal */
  [IsAlias] = false;
  /** @internal */
  [IsDrizzleTable] = true;
  /** @internal */
  [ExtraConfigBuilder] = void 0;
  constructor(name, schema2, baseName) {
    this[TableName] = this[OriginalName] = name;
    this[Schema] = schema2;
    this[BaseName] = baseName;
  }
};
function getTableName(table) {
  return table[TableName];
}
function getTableUniqueName(table) {
  return `${table[Schema] ?? "public"}.${table[TableName]}`;
}

// node_modules/drizzle-orm/sql/sql.js
var FakePrimitiveParam = class {
  static [entityKind] = "FakePrimitiveParam";
};
function isSQLWrapper(value) {
  return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
function mergeQueries(queries) {
  const result = { sql: "", params: [] };
  for (const query of queries) {
    result.sql += query.sql;
    result.params.push(...query.params);
    if (query.typings?.length) {
      if (!result.typings) {
        result.typings = [];
      }
      result.typings.push(...query.typings);
    }
  }
  return result;
}
var StringChunk = class {
  static [entityKind] = "StringChunk";
  value;
  constructor(value) {
    this.value = Array.isArray(value) ? value : [value];
  }
  getSQL() {
    return new SQL([this]);
  }
};
var SQL = class _SQL {
  constructor(queryChunks) {
    this.queryChunks = queryChunks;
    for (const chunk of queryChunks) {
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        this.usedTables.push(
          schemaName === void 0 ? chunk[Table.Symbol.Name] : schemaName + "." + chunk[Table.Symbol.Name]
        );
      }
    }
  }
  static [entityKind] = "SQL";
  /** @internal */
  decoder = noopDecoder;
  shouldInlineParams = false;
  /** @internal */
  usedTables = [];
  append(query) {
    this.queryChunks.push(...query.queryChunks);
    return this;
  }
  toQuery(config) {
    return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
      const query = this.buildQueryFromSourceParams(this.queryChunks, config);
      span?.setAttributes({
        "drizzle.query.text": query.sql,
        "drizzle.query.params": JSON.stringify(query.params)
      });
      return query;
    });
  }
  buildQueryFromSourceParams(chunks, _config) {
    const config = Object.assign({}, _config, {
      inlineParams: _config.inlineParams || this.shouldInlineParams,
      paramStartIndex: _config.paramStartIndex || { value: 0 }
    });
    const {
      casing,
      escapeName,
      escapeParam,
      prepareTyping,
      inlineParams,
      paramStartIndex
    } = config;
    return mergeQueries(chunks.map((chunk) => {
      if (is(chunk, StringChunk)) {
        return { sql: chunk.value.join(""), params: [] };
      }
      if (is(chunk, Name)) {
        return { sql: escapeName(chunk.value), params: [] };
      }
      if (chunk === void 0) {
        return { sql: "", params: [] };
      }
      if (Array.isArray(chunk)) {
        const result = [new StringChunk("(")];
        for (const [i, p2] of chunk.entries()) {
          result.push(p2);
          if (i < chunk.length - 1) {
            result.push(new StringChunk(", "));
          }
        }
        result.push(new StringChunk(")"));
        return this.buildQueryFromSourceParams(result, config);
      }
      if (is(chunk, _SQL)) {
        return this.buildQueryFromSourceParams(chunk.queryChunks, {
          ...config,
          inlineParams: inlineParams || chunk.shouldInlineParams
        });
      }
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        const tableName = chunk[Table.Symbol.Name];
        return {
          sql: schemaName === void 0 || chunk[IsAlias] ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
          params: []
        };
      }
      if (is(chunk, Column)) {
        const columnName = casing.getColumnCasing(chunk);
        if (_config.invokeSource === "indexes") {
          return { sql: escapeName(columnName), params: [] };
        }
        const schemaName = chunk.table[Table.Symbol.Schema];
        return {
          sql: chunk.table[IsAlias] || schemaName === void 0 ? escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName) : escapeName(schemaName) + "." + escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName),
          params: []
        };
      }
      if (is(chunk, View)) {
        const schemaName = chunk[ViewBaseConfig].schema;
        const viewName = chunk[ViewBaseConfig].name;
        return {
          sql: schemaName === void 0 || chunk[ViewBaseConfig].isAlias ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
          params: []
        };
      }
      if (is(chunk, Param)) {
        if (is(chunk.value, Placeholder)) {
          return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
        }
        const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
        if (is(mappedValue, _SQL)) {
          return this.buildQueryFromSourceParams([mappedValue], config);
        }
        if (inlineParams) {
          return { sql: this.mapInlineParam(mappedValue, config), params: [] };
        }
        let typings = ["none"];
        if (prepareTyping) {
          typings = [prepareTyping(chunk.encoder)];
        }
        return { sql: escapeParam(paramStartIndex.value++, mappedValue), params: [mappedValue], typings };
      }
      if (is(chunk, Placeholder)) {
        return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
      }
      if (is(chunk, _SQL.Aliased) && chunk.fieldAlias !== void 0) {
        return { sql: escapeName(chunk.fieldAlias), params: [] };
      }
      if (is(chunk, Subquery)) {
        if (chunk._.isWith) {
          return { sql: escapeName(chunk._.alias), params: [] };
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk._.sql,
          new StringChunk(") "),
          new Name(chunk._.alias)
        ], config);
      }
      if (isPgEnum(chunk)) {
        if (chunk.schema) {
          return { sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName), params: [] };
        }
        return { sql: escapeName(chunk.enumName), params: [] };
      }
      if (isSQLWrapper(chunk)) {
        if (chunk.shouldOmitSQLParens?.()) {
          return this.buildQueryFromSourceParams([chunk.getSQL()], config);
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk.getSQL(),
          new StringChunk(")")
        ], config);
      }
      if (inlineParams) {
        return { sql: this.mapInlineParam(chunk, config), params: [] };
      }
      return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
    }));
  }
  mapInlineParam(chunk, { escapeString }) {
    if (chunk === null) {
      return "null";
    }
    if (typeof chunk === "number" || typeof chunk === "boolean") {
      return chunk.toString();
    }
    if (typeof chunk === "string") {
      return escapeString(chunk);
    }
    if (typeof chunk === "object") {
      const mappedValueAsString = chunk.toString();
      if (mappedValueAsString === "[object Object]") {
        return escapeString(JSON.stringify(chunk));
      }
      return escapeString(mappedValueAsString);
    }
    throw new Error("Unexpected param value: " + chunk);
  }
  getSQL() {
    return this;
  }
  as(alias) {
    if (alias === void 0) {
      return this;
    }
    return new _SQL.Aliased(this, alias);
  }
  mapWith(decoder) {
    this.decoder = typeof decoder === "function" ? { mapFromDriverValue: decoder } : decoder;
    return this;
  }
  inlineParams() {
    this.shouldInlineParams = true;
    return this;
  }
  /**
   * This method is used to conditionally include a part of the query.
   *
   * @param condition - Condition to check
   * @returns itself if the condition is `true`, otherwise `undefined`
   */
  if(condition) {
    return condition ? this : void 0;
  }
};
var Name = class {
  constructor(value) {
    this.value = value;
  }
  static [entityKind] = "Name";
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
function isDriverValueEncoder(value) {
  return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
}
var noopDecoder = {
  mapFromDriverValue: (value) => value
};
var noopEncoder = {
  mapToDriverValue: (value) => value
};
var noopMapper = {
  ...noopDecoder,
  ...noopEncoder
};
var Param = class {
  /**
   * @param value - Parameter value
   * @param encoder - Encoder to convert the value to a driver parameter
   */
  constructor(value, encoder = noopEncoder) {
    this.value = value;
    this.encoder = encoder;
  }
  static [entityKind] = "Param";
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
function sql(strings, ...params) {
  const queryChunks = [];
  if (params.length > 0 || strings.length > 0 && strings[0] !== "") {
    queryChunks.push(new StringChunk(strings[0]));
  }
  for (const [paramIndex, param2] of params.entries()) {
    queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
  }
  return new SQL(queryChunks);
}
((sql2) => {
  function empty() {
    return new SQL([]);
  }
  sql2.empty = empty;
  function fromList(list) {
    return new SQL(list);
  }
  sql2.fromList = fromList;
  function raw(str) {
    return new SQL([new StringChunk(str)]);
  }
  sql2.raw = raw;
  function join(chunks, separator) {
    const result = [];
    for (const [i, chunk] of chunks.entries()) {
      if (i > 0 && separator !== void 0) {
        result.push(separator);
      }
      result.push(chunk);
    }
    return new SQL(result);
  }
  sql2.join = join;
  function identifier(value) {
    return new Name(value);
  }
  sql2.identifier = identifier;
  function placeholder2(name2) {
    return new Placeholder(name2);
  }
  sql2.placeholder = placeholder2;
  function param2(value, encoder) {
    return new Param(value, encoder);
  }
  sql2.param = param2;
})(sql || (sql = {}));
((SQL2) => {
  class Aliased {
    constructor(sql2, fieldAlias) {
      this.sql = sql2;
      this.fieldAlias = fieldAlias;
    }
    static [entityKind] = "SQL.Aliased";
    /** @internal */
    isSelectionField = false;
    getSQL() {
      return this.sql;
    }
    /** @internal */
    clone() {
      return new Aliased(this.sql, this.fieldAlias);
    }
  }
  SQL2.Aliased = Aliased;
})(SQL || (SQL = {}));
var Placeholder = class {
  constructor(name2) {
    this.name = name2;
  }
  static [entityKind] = "Placeholder";
  getSQL() {
    return new SQL([this]);
  }
};
function fillPlaceholders(params, values) {
  return params.map((p2) => {
    if (is(p2, Placeholder)) {
      if (!(p2.name in values)) {
        throw new Error(`No value for placeholder "${p2.name}" was provided`);
      }
      return values[p2.name];
    }
    if (is(p2, Param) && is(p2.value, Placeholder)) {
      if (!(p2.value.name in values)) {
        throw new Error(`No value for placeholder "${p2.value.name}" was provided`);
      }
      return p2.encoder.mapToDriverValue(values[p2.value.name]);
    }
    return p2;
  });
}
var IsDrizzleView = Symbol.for("drizzle:IsDrizzleView");
var View = class {
  static [entityKind] = "View";
  /** @internal */
  [ViewBaseConfig];
  /** @internal */
  [IsDrizzleView] = true;
  constructor({ name: name2, schema: schema2, selectedFields, query }) {
    this[ViewBaseConfig] = {
      name: name2,
      originalName: name2,
      schema: schema2,
      selectedFields,
      query,
      isExisting: !query,
      isAlias: false
    };
  }
  getSQL() {
    return new SQL([this]);
  }
};
Column.prototype.getSQL = function() {
  return new SQL([this]);
};
Table.prototype.getSQL = function() {
  return new SQL([this]);
};
Subquery.prototype.getSQL = function() {
  return new SQL([this]);
};

// node_modules/drizzle-orm/alias.js
var ColumnAliasProxyHandler = class {
  constructor(table) {
    this.table = table;
  }
  static [entityKind] = "ColumnAliasProxyHandler";
  get(columnObj, prop) {
    if (prop === "table") {
      return this.table;
    }
    return columnObj[prop];
  }
};
var TableAliasProxyHandler = class {
  constructor(alias, replaceOriginalName) {
    this.alias = alias;
    this.replaceOriginalName = replaceOriginalName;
  }
  static [entityKind] = "TableAliasProxyHandler";
  get(target, prop) {
    if (prop === Table.Symbol.IsAlias) {
      return true;
    }
    if (prop === Table.Symbol.Name) {
      return this.alias;
    }
    if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) {
      return this.alias;
    }
    if (prop === ViewBaseConfig) {
      return {
        ...target[ViewBaseConfig],
        name: this.alias,
        isAlias: true
      };
    }
    if (prop === Table.Symbol.Columns) {
      const columns = target[Table.Symbol.Columns];
      if (!columns) {
        return columns;
      }
      const proxiedColumns = {};
      Object.keys(columns).map((key) => {
        proxiedColumns[key] = new Proxy(
          columns[key],
          new ColumnAliasProxyHandler(new Proxy(target, this))
        );
      });
      return proxiedColumns;
    }
    const value = target[prop];
    if (is(value, Column)) {
      return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(target, this)));
    }
    return value;
  }
};
var RelationTableAliasProxyHandler = class {
  constructor(alias) {
    this.alias = alias;
  }
  static [entityKind] = "RelationTableAliasProxyHandler";
  get(target, prop) {
    if (prop === "sourceTable") {
      return aliasedTable(target.sourceTable, this.alias);
    }
    return target[prop];
  }
};
function aliasedTable(table, tableAlias) {
  return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
function aliasedTableColumn(column, tableAlias) {
  return new Proxy(
    column,
    new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false)))
  );
}
function mapColumnsInAliasedSQLToAlias(query, alias) {
  return new SQL.Aliased(mapColumnsInSQLToAlias(query.sql, alias), query.fieldAlias);
}
function mapColumnsInSQLToAlias(query, alias) {
  return sql.join(query.queryChunks.map((c) => {
    if (is(c, Column)) {
      return aliasedTableColumn(c, alias);
    }
    if (is(c, SQL)) {
      return mapColumnsInSQLToAlias(c, alias);
    }
    if (is(c, SQL.Aliased)) {
      return mapColumnsInAliasedSQLToAlias(c, alias);
    }
    return c;
  }));
}

// node_modules/drizzle-orm/errors.js
var DrizzleError = class extends Error {
  static [entityKind] = "DrizzleError";
  constructor({ message, cause }) {
    super(message);
    this.name = "DrizzleError";
    this.cause = cause;
  }
};
var DrizzleQueryError = class _DrizzleQueryError extends Error {
  constructor(query, params, cause) {
    super(`Failed query: ${query}
params: ${params}`);
    this.query = query;
    this.params = params;
    this.cause = cause;
    Error.captureStackTrace(this, _DrizzleQueryError);
    if (cause) this.cause = cause;
  }
};
var TransactionRollbackError = class extends DrizzleError {
  static [entityKind] = "TransactionRollbackError";
  constructor() {
    super({ message: "Rollback" });
  }
};

// node_modules/drizzle-orm/logger.js
var ConsoleLogWriter = class {
  static [entityKind] = "ConsoleLogWriter";
  write(message) {
    console.log(message);
  }
};
var DefaultLogger = class {
  static [entityKind] = "DefaultLogger";
  writer;
  constructor(config) {
    this.writer = config?.writer ?? new ConsoleLogWriter();
  }
  logQuery(query, params) {
    const stringifiedParams = params.map((p2) => {
      try {
        return JSON.stringify(p2);
      } catch {
        return String(p2);
      }
    });
    const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
    this.writer.write(`Query: ${query}${paramsStr}`);
  }
};
var NoopLogger = class {
  static [entityKind] = "NoopLogger";
  logQuery() {
  }
};

// node_modules/drizzle-orm/query-promise.js
var QueryPromise = class {
  static [entityKind] = "QueryPromise";
  [Symbol.toStringTag] = "QueryPromise";
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally?.();
        return value;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      }
    );
  }
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
};

// node_modules/drizzle-orm/utils.js
function mapResultRow(columns, row, joinsNotNullableMap) {
  const nullifyMap = {};
  const result = columns.reduce(
    (result2, { path, field }, columnIndex) => {
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else if (is(field, Subquery)) {
        decoder = field._.sql.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      let node = result2;
      for (const [pathChunkIndex, pathChunk] of path.entries()) {
        if (pathChunkIndex < path.length - 1) {
          if (!(pathChunk in node)) {
            node[pathChunk] = {};
          }
          node = node[pathChunk];
        } else {
          const rawValue = row[columnIndex];
          const value = node[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
          if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
            const objectName = path[0];
            if (!(objectName in nullifyMap)) {
              nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
            } else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field.table)) {
              nullifyMap[objectName] = false;
            }
          }
        }
      }
      return result2;
    },
    {}
  );
  if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
    for (const [objectName, tableName] of Object.entries(nullifyMap)) {
      if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) {
        result[objectName] = null;
      }
    }
  }
  return result;
}
function orderSelectedFields(fields, pathPrefix) {
  return Object.entries(fields).reduce((result, [name, field]) => {
    if (typeof name !== "string") {
      return result;
    }
    const newPath = pathPrefix ? [...pathPrefix, name] : [name];
    if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased) || is(field, Subquery)) {
      result.push({ path: newPath, field });
    } else if (is(field, Table)) {
      result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
    } else {
      result.push(...orderSelectedFields(field, newPath));
    }
    return result;
  }, []);
}
function haveSameKeys(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const [index2, key] of leftKeys.entries()) {
    if (key !== rightKeys[index2]) {
      return false;
    }
  }
  return true;
}
function mapUpdateSet(table, values) {
  const entries = Object.entries(values).filter(([, value]) => value !== void 0).map(([key, value]) => {
    if (is(value, SQL) || is(value, Column)) {
      return [key, value];
    } else {
      return [key, new Param(value, table[Table.Symbol.Columns][key])];
    }
  });
  if (entries.length === 0) {
    throw new Error("No values to set");
  }
  return Object.fromEntries(entries);
}
function applyMixins(baseClass, extendedClasses) {
  for (const extendedClass of extendedClasses) {
    for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
      if (name === "constructor") continue;
      Object.defineProperty(
        baseClass.prototype,
        name,
        Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || /* @__PURE__ */ Object.create(null)
      );
    }
  }
}
function getTableColumns(table) {
  return table[Table.Symbol.Columns];
}
function getTableLikeName(table) {
  return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
function getColumnNameAndConfig(a, b) {
  return {
    name: typeof a === "string" && a.length > 0 ? a : "",
    config: typeof a === "object" ? a : b
  };
}
function isConfig(data) {
  if (typeof data !== "object" || data === null) return false;
  if (data.constructor.name !== "Object") return false;
  if ("logger" in data) {
    const type = typeof data["logger"];
    if (type !== "boolean" && (type !== "object" || typeof data["logger"]["logQuery"] !== "function") && type !== "undefined") return false;
    return true;
  }
  if ("schema" in data) {
    const type = typeof data["schema"];
    if (type !== "object" && type !== "undefined") return false;
    return true;
  }
  if ("casing" in data) {
    const type = typeof data["casing"];
    if (type !== "string" && type !== "undefined") return false;
    return true;
  }
  if ("mode" in data) {
    if (data["mode"] !== "default" || data["mode"] !== "planetscale" || data["mode"] !== void 0) return false;
    return true;
  }
  if ("connection" in data) {
    const type = typeof data["connection"];
    if (type !== "string" && type !== "object" && type !== "undefined") return false;
    return true;
  }
  if ("client" in data) {
    const type = typeof data["client"];
    if (type !== "object" && type !== "function" && type !== "undefined") return false;
    return true;
  }
  if (Object.keys(data).length === 0) return true;
  return false;
}
var textDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder();

// node_modules/drizzle-orm/pg-core/columns/int.common.js
var PgIntColumnBaseBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgIntColumnBaseBuilder";
  generatedAlwaysAsIdentity(sequence) {
    if (sequence) {
      const { name, ...options } = sequence;
      this.config.generatedIdentity = {
        type: "always",
        sequenceName: name,
        sequenceOptions: options
      };
    } else {
      this.config.generatedIdentity = {
        type: "always"
      };
    }
    this.config.hasDefault = true;
    this.config.notNull = true;
    return this;
  }
  generatedByDefaultAsIdentity(sequence) {
    if (sequence) {
      const { name, ...options } = sequence;
      this.config.generatedIdentity = {
        type: "byDefault",
        sequenceName: name,
        sequenceOptions: options
      };
    } else {
      this.config.generatedIdentity = {
        type: "byDefault"
      };
    }
    this.config.hasDefault = true;
    this.config.notNull = true;
    return this;
  }
};

// node_modules/drizzle-orm/pg-core/columns/bigint.js
var PgBigInt53Builder = class extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgBigInt53Builder";
  constructor(name) {
    super(name, "number", "PgBigInt53");
  }
  /** @internal */
  build(table) {
    return new PgBigInt53(table, this.config);
  }
};
var PgBigInt53 = class extends PgColumn {
  static [entityKind] = "PgBigInt53";
  getSQLType() {
    return "bigint";
  }
  mapFromDriverValue(value) {
    if (typeof value === "number") {
      return value;
    }
    return Number(value);
  }
};
var PgBigInt64Builder = class extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgBigInt64Builder";
  constructor(name) {
    super(name, "bigint", "PgBigInt64");
  }
  /** @internal */
  build(table) {
    return new PgBigInt64(
      table,
      this.config
    );
  }
};
var PgBigInt64 = class extends PgColumn {
  static [entityKind] = "PgBigInt64";
  getSQLType() {
    return "bigint";
  }
  // eslint-disable-next-line unicorn/prefer-native-coercion-functions
  mapFromDriverValue(value) {
    return BigInt(value);
  }
};
function bigint(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config.mode === "number") {
    return new PgBigInt53Builder(name);
  }
  return new PgBigInt64Builder(name);
}

// node_modules/drizzle-orm/pg-core/columns/bigserial.js
var PgBigSerial53Builder = class extends PgColumnBuilder {
  static [entityKind] = "PgBigSerial53Builder";
  constructor(name) {
    super(name, "number", "PgBigSerial53");
    this.config.hasDefault = true;
    this.config.notNull = true;
  }
  /** @internal */
  build(table) {
    return new PgBigSerial53(
      table,
      this.config
    );
  }
};
var PgBigSerial53 = class extends PgColumn {
  static [entityKind] = "PgBigSerial53";
  getSQLType() {
    return "bigserial";
  }
  mapFromDriverValue(value) {
    if (typeof value === "number") {
      return value;
    }
    return Number(value);
  }
};
var PgBigSerial64Builder = class extends PgColumnBuilder {
  static [entityKind] = "PgBigSerial64Builder";
  constructor(name) {
    super(name, "bigint", "PgBigSerial64");
    this.config.hasDefault = true;
  }
  /** @internal */
  build(table) {
    return new PgBigSerial64(
      table,
      this.config
    );
  }
};
var PgBigSerial64 = class extends PgColumn {
  static [entityKind] = "PgBigSerial64";
  getSQLType() {
    return "bigserial";
  }
  // eslint-disable-next-line unicorn/prefer-native-coercion-functions
  mapFromDriverValue(value) {
    return BigInt(value);
  }
};
function bigserial(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config.mode === "number") {
    return new PgBigSerial53Builder(name);
  }
  return new PgBigSerial64Builder(name);
}

// node_modules/drizzle-orm/pg-core/columns/boolean.js
var PgBooleanBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgBooleanBuilder";
  constructor(name) {
    super(name, "boolean", "PgBoolean");
  }
  /** @internal */
  build(table) {
    return new PgBoolean(table, this.config);
  }
};
var PgBoolean = class extends PgColumn {
  static [entityKind] = "PgBoolean";
  getSQLType() {
    return "boolean";
  }
};
function boolean(name) {
  return new PgBooleanBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/char.js
var PgCharBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgCharBuilder";
  constructor(name, config) {
    super(name, "string", "PgChar");
    this.config.length = config.length;
    this.config.enumValues = config.enum;
  }
  /** @internal */
  build(table) {
    return new PgChar(
      table,
      this.config
    );
  }
};
var PgChar = class extends PgColumn {
  static [entityKind] = "PgChar";
  length = this.config.length;
  enumValues = this.config.enumValues;
  getSQLType() {
    return this.length === void 0 ? `char` : `char(${this.length})`;
  }
};
function char(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgCharBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/cidr.js
var PgCidrBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgCidrBuilder";
  constructor(name) {
    super(name, "string", "PgCidr");
  }
  /** @internal */
  build(table) {
    return new PgCidr(table, this.config);
  }
};
var PgCidr = class extends PgColumn {
  static [entityKind] = "PgCidr";
  getSQLType() {
    return "cidr";
  }
};
function cidr(name) {
  return new PgCidrBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/custom.js
var PgCustomColumnBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgCustomColumnBuilder";
  constructor(name, fieldConfig, customTypeParams) {
    super(name, "custom", "PgCustomColumn");
    this.config.fieldConfig = fieldConfig;
    this.config.customTypeParams = customTypeParams;
  }
  /** @internal */
  build(table) {
    return new PgCustomColumn(
      table,
      this.config
    );
  }
};
var PgCustomColumn = class extends PgColumn {
  static [entityKind] = "PgCustomColumn";
  sqlName;
  mapTo;
  mapFrom;
  constructor(table, config) {
    super(table, config);
    this.sqlName = config.customTypeParams.dataType(config.fieldConfig);
    this.mapTo = config.customTypeParams.toDriver;
    this.mapFrom = config.customTypeParams.fromDriver;
  }
  getSQLType() {
    return this.sqlName;
  }
  mapFromDriverValue(value) {
    return typeof this.mapFrom === "function" ? this.mapFrom(value) : value;
  }
  mapToDriverValue(value) {
    return typeof this.mapTo === "function" ? this.mapTo(value) : value;
  }
};
function customType(customTypeParams) {
  return (a, b) => {
    const { name, config } = getColumnNameAndConfig(a, b);
    return new PgCustomColumnBuilder(name, config, customTypeParams);
  };
}

// node_modules/drizzle-orm/pg-core/columns/date.common.js
var PgDateColumnBaseBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgDateColumnBaseBuilder";
  defaultNow() {
    return this.default(sql`now()`);
  }
};

// node_modules/drizzle-orm/pg-core/columns/date.js
var PgDateBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgDateBuilder";
  constructor(name) {
    super(name, "date", "PgDate");
  }
  /** @internal */
  build(table) {
    return new PgDate(table, this.config);
  }
};
var PgDate = class extends PgColumn {
  static [entityKind] = "PgDate";
  getSQLType() {
    return "date";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") return new Date(value);
    return value;
  }
  mapToDriverValue(value) {
    return value.toISOString();
  }
};
var PgDateStringBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgDateStringBuilder";
  constructor(name) {
    super(name, "string", "PgDateString");
  }
  /** @internal */
  build(table) {
    return new PgDateString(
      table,
      this.config
    );
  }
};
var PgDateString = class extends PgColumn {
  static [entityKind] = "PgDateString";
  getSQLType() {
    return "date";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") return value;
    return value.toISOString().slice(0, -14);
  }
};
function date(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config?.mode === "date") {
    return new PgDateBuilder(name);
  }
  return new PgDateStringBuilder(name);
}

// node_modules/drizzle-orm/pg-core/columns/double-precision.js
var PgDoublePrecisionBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgDoublePrecisionBuilder";
  constructor(name) {
    super(name, "number", "PgDoublePrecision");
  }
  /** @internal */
  build(table) {
    return new PgDoublePrecision(
      table,
      this.config
    );
  }
};
var PgDoublePrecision = class extends PgColumn {
  static [entityKind] = "PgDoublePrecision";
  getSQLType() {
    return "double precision";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      return Number.parseFloat(value);
    }
    return value;
  }
};
function doublePrecision(name) {
  return new PgDoublePrecisionBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/inet.js
var PgInetBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgInetBuilder";
  constructor(name) {
    super(name, "string", "PgInet");
  }
  /** @internal */
  build(table) {
    return new PgInet(table, this.config);
  }
};
var PgInet = class extends PgColumn {
  static [entityKind] = "PgInet";
  getSQLType() {
    return "inet";
  }
};
function inet(name) {
  return new PgInetBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/integer.js
var PgIntegerBuilder = class extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgIntegerBuilder";
  constructor(name) {
    super(name, "number", "PgInteger");
  }
  /** @internal */
  build(table) {
    return new PgInteger(table, this.config);
  }
};
var PgInteger = class extends PgColumn {
  static [entityKind] = "PgInteger";
  getSQLType() {
    return "integer";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      return Number.parseInt(value);
    }
    return value;
  }
};
function integer(name) {
  return new PgIntegerBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/interval.js
var PgIntervalBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgIntervalBuilder";
  constructor(name, intervalConfig) {
    super(name, "string", "PgInterval");
    this.config.intervalConfig = intervalConfig;
  }
  /** @internal */
  build(table) {
    return new PgInterval(table, this.config);
  }
};
var PgInterval = class extends PgColumn {
  static [entityKind] = "PgInterval";
  fields = this.config.intervalConfig.fields;
  precision = this.config.intervalConfig.precision;
  getSQLType() {
    const fields = this.fields ? ` ${this.fields}` : "";
    const precision = this.precision ? `(${this.precision})` : "";
    return `interval${fields}${precision}`;
  }
};
function interval(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgIntervalBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/json.js
var PgJsonBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgJsonBuilder";
  constructor(name) {
    super(name, "json", "PgJson");
  }
  /** @internal */
  build(table) {
    return new PgJson(table, this.config);
  }
};
var PgJson = class extends PgColumn {
  static [entityKind] = "PgJson";
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return "json";
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
};
function json(name) {
  return new PgJsonBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/jsonb.js
var PgJsonbBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgJsonbBuilder";
  constructor(name) {
    super(name, "json", "PgJsonb");
  }
  /** @internal */
  build(table) {
    return new PgJsonb(table, this.config);
  }
};
var PgJsonb = class extends PgColumn {
  static [entityKind] = "PgJsonb";
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return "jsonb";
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
};
function jsonb(name) {
  return new PgJsonbBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/line.js
var PgLineBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgLineBuilder";
  constructor(name) {
    super(name, "array", "PgLine");
  }
  /** @internal */
  build(table) {
    return new PgLineTuple(
      table,
      this.config
    );
  }
};
var PgLineTuple = class extends PgColumn {
  static [entityKind] = "PgLine";
  getSQLType() {
    return "line";
  }
  mapFromDriverValue(value) {
    const [a, b, c] = value.slice(1, -1).split(",");
    return [Number.parseFloat(a), Number.parseFloat(b), Number.parseFloat(c)];
  }
  mapToDriverValue(value) {
    return `{${value[0]},${value[1]},${value[2]}}`;
  }
};
var PgLineABCBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgLineABCBuilder";
  constructor(name) {
    super(name, "json", "PgLineABC");
  }
  /** @internal */
  build(table) {
    return new PgLineABC(
      table,
      this.config
    );
  }
};
var PgLineABC = class extends PgColumn {
  static [entityKind] = "PgLineABC";
  getSQLType() {
    return "line";
  }
  mapFromDriverValue(value) {
    const [a, b, c] = value.slice(1, -1).split(",");
    return { a: Number.parseFloat(a), b: Number.parseFloat(b), c: Number.parseFloat(c) };
  }
  mapToDriverValue(value) {
    return `{${value.a},${value.b},${value.c}}`;
  }
};
function line(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (!config?.mode || config.mode === "tuple") {
    return new PgLineBuilder(name);
  }
  return new PgLineABCBuilder(name);
}

// node_modules/drizzle-orm/pg-core/columns/macaddr.js
var PgMacaddrBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgMacaddrBuilder";
  constructor(name) {
    super(name, "string", "PgMacaddr");
  }
  /** @internal */
  build(table) {
    return new PgMacaddr(table, this.config);
  }
};
var PgMacaddr = class extends PgColumn {
  static [entityKind] = "PgMacaddr";
  getSQLType() {
    return "macaddr";
  }
};
function macaddr(name) {
  return new PgMacaddrBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/macaddr8.js
var PgMacaddr8Builder = class extends PgColumnBuilder {
  static [entityKind] = "PgMacaddr8Builder";
  constructor(name) {
    super(name, "string", "PgMacaddr8");
  }
  /** @internal */
  build(table) {
    return new PgMacaddr8(table, this.config);
  }
};
var PgMacaddr8 = class extends PgColumn {
  static [entityKind] = "PgMacaddr8";
  getSQLType() {
    return "macaddr8";
  }
};
function macaddr8(name) {
  return new PgMacaddr8Builder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/numeric.js
var PgNumericBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgNumericBuilder";
  constructor(name, precision, scale) {
    super(name, "string", "PgNumeric");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumeric(table, this.config);
  }
};
var PgNumeric = class extends PgColumn {
  static [entityKind] = "PgNumeric";
  precision;
  scale;
  constructor(table, config) {
    super(table, config);
    this.precision = config.precision;
    this.scale = config.scale;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") return value;
    return String(value);
  }
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
};
var PgNumericNumberBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgNumericNumberBuilder";
  constructor(name, precision, scale) {
    super(name, "number", "PgNumericNumber");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumericNumber(
      table,
      this.config
    );
  }
};
var PgNumericNumber = class extends PgColumn {
  static [entityKind] = "PgNumericNumber";
  precision;
  scale;
  constructor(table, config) {
    super(table, config);
    this.precision = config.precision;
    this.scale = config.scale;
  }
  mapFromDriverValue(value) {
    if (typeof value === "number") return value;
    return Number(value);
  }
  mapToDriverValue = String;
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
};
var PgNumericBigIntBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgNumericBigIntBuilder";
  constructor(name, precision, scale) {
    super(name, "bigint", "PgNumericBigInt");
    this.config.precision = precision;
    this.config.scale = scale;
  }
  /** @internal */
  build(table) {
    return new PgNumericBigInt(
      table,
      this.config
    );
  }
};
var PgNumericBigInt = class extends PgColumn {
  static [entityKind] = "PgNumericBigInt";
  precision;
  scale;
  constructor(table, config) {
    super(table, config);
    this.precision = config.precision;
    this.scale = config.scale;
  }
  mapFromDriverValue = BigInt;
  mapToDriverValue = String;
  getSQLType() {
    if (this.precision !== void 0 && this.scale !== void 0) {
      return `numeric(${this.precision}, ${this.scale})`;
    } else if (this.precision === void 0) {
      return "numeric";
    } else {
      return `numeric(${this.precision})`;
    }
  }
};
function numeric(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  const mode = config?.mode;
  return mode === "number" ? new PgNumericNumberBuilder(name, config?.precision, config?.scale) : mode === "bigint" ? new PgNumericBigIntBuilder(name, config?.precision, config?.scale) : new PgNumericBuilder(name, config?.precision, config?.scale);
}

// node_modules/drizzle-orm/pg-core/columns/point.js
var PgPointTupleBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgPointTupleBuilder";
  constructor(name) {
    super(name, "array", "PgPointTuple");
  }
  /** @internal */
  build(table) {
    return new PgPointTuple(
      table,
      this.config
    );
  }
};
var PgPointTuple = class extends PgColumn {
  static [entityKind] = "PgPointTuple";
  getSQLType() {
    return "point";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      const [x, y] = value.slice(1, -1).split(",");
      return [Number.parseFloat(x), Number.parseFloat(y)];
    }
    return [value.x, value.y];
  }
  mapToDriverValue(value) {
    return `(${value[0]},${value[1]})`;
  }
};
var PgPointObjectBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgPointObjectBuilder";
  constructor(name) {
    super(name, "json", "PgPointObject");
  }
  /** @internal */
  build(table) {
    return new PgPointObject(
      table,
      this.config
    );
  }
};
var PgPointObject = class extends PgColumn {
  static [entityKind] = "PgPointObject";
  getSQLType() {
    return "point";
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      const [x, y] = value.slice(1, -1).split(",");
      return { x: Number.parseFloat(x), y: Number.parseFloat(y) };
    }
    return value;
  }
  mapToDriverValue(value) {
    return `(${value.x},${value.y})`;
  }
};
function point(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (!config?.mode || config.mode === "tuple") {
    return new PgPointTupleBuilder(name);
  }
  return new PgPointObjectBuilder(name);
}

// node_modules/drizzle-orm/pg-core/columns/postgis_extension/utils.js
function hexToBytes(hex) {
  const bytes = [];
  for (let c = 0; c < hex.length; c += 2) {
    bytes.push(Number.parseInt(hex.slice(c, c + 2), 16));
  }
  return new Uint8Array(bytes);
}
function bytesToFloat64(bytes, offset) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  for (let i = 0; i < 8; i++) {
    view.setUint8(i, bytes[offset + i]);
  }
  return view.getFloat64(0, true);
}
function parseEWKB(hex) {
  const bytes = hexToBytes(hex);
  let offset = 0;
  const byteOrder = bytes[offset];
  offset += 1;
  const view = new DataView(bytes.buffer);
  const geomType = view.getUint32(offset, byteOrder === 1);
  offset += 4;
  let _srid;
  if (geomType & 536870912) {
    _srid = view.getUint32(offset, byteOrder === 1);
    offset += 4;
  }
  if ((geomType & 65535) === 1) {
    const x = bytesToFloat64(bytes, offset);
    offset += 8;
    const y = bytesToFloat64(bytes, offset);
    offset += 8;
    return [x, y];
  }
  throw new Error("Unsupported geometry type");
}

// node_modules/drizzle-orm/pg-core/columns/postgis_extension/geometry.js
var PgGeometryBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgGeometryBuilder";
  constructor(name) {
    super(name, "array", "PgGeometry");
  }
  /** @internal */
  build(table) {
    return new PgGeometry(
      table,
      this.config
    );
  }
};
var PgGeometry = class extends PgColumn {
  static [entityKind] = "PgGeometry";
  getSQLType() {
    return "geometry(point)";
  }
  mapFromDriverValue(value) {
    return parseEWKB(value);
  }
  mapToDriverValue(value) {
    return `point(${value[0]} ${value[1]})`;
  }
};
var PgGeometryObjectBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgGeometryObjectBuilder";
  constructor(name) {
    super(name, "json", "PgGeometryObject");
  }
  /** @internal */
  build(table) {
    return new PgGeometryObject(
      table,
      this.config
    );
  }
};
var PgGeometryObject = class extends PgColumn {
  static [entityKind] = "PgGeometryObject";
  getSQLType() {
    return "geometry(point)";
  }
  mapFromDriverValue(value) {
    const parsed = parseEWKB(value);
    return { x: parsed[0], y: parsed[1] };
  }
  mapToDriverValue(value) {
    return `point(${value.x} ${value.y})`;
  }
};
function geometry(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (!config?.mode || config.mode === "tuple") {
    return new PgGeometryBuilder(name);
  }
  return new PgGeometryObjectBuilder(name);
}

// node_modules/drizzle-orm/pg-core/columns/real.js
var PgRealBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgRealBuilder";
  constructor(name, length) {
    super(name, "number", "PgReal");
    this.config.length = length;
  }
  /** @internal */
  build(table) {
    return new PgReal(table, this.config);
  }
};
var PgReal = class extends PgColumn {
  static [entityKind] = "PgReal";
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return "real";
  }
  mapFromDriverValue = (value) => {
    if (typeof value === "string") {
      return Number.parseFloat(value);
    }
    return value;
  };
};
function real(name) {
  return new PgRealBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/serial.js
var PgSerialBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgSerialBuilder";
  constructor(name) {
    super(name, "number", "PgSerial");
    this.config.hasDefault = true;
    this.config.notNull = true;
  }
  /** @internal */
  build(table) {
    return new PgSerial(table, this.config);
  }
};
var PgSerial = class extends PgColumn {
  static [entityKind] = "PgSerial";
  getSQLType() {
    return "serial";
  }
};
function serial(name) {
  return new PgSerialBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/smallint.js
var PgSmallIntBuilder = class extends PgIntColumnBaseBuilder {
  static [entityKind] = "PgSmallIntBuilder";
  constructor(name) {
    super(name, "number", "PgSmallInt");
  }
  /** @internal */
  build(table) {
    return new PgSmallInt(table, this.config);
  }
};
var PgSmallInt = class extends PgColumn {
  static [entityKind] = "PgSmallInt";
  getSQLType() {
    return "smallint";
  }
  mapFromDriverValue = (value) => {
    if (typeof value === "string") {
      return Number(value);
    }
    return value;
  };
};
function smallint(name) {
  return new PgSmallIntBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/smallserial.js
var PgSmallSerialBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgSmallSerialBuilder";
  constructor(name) {
    super(name, "number", "PgSmallSerial");
    this.config.hasDefault = true;
    this.config.notNull = true;
  }
  /** @internal */
  build(table) {
    return new PgSmallSerial(
      table,
      this.config
    );
  }
};
var PgSmallSerial = class extends PgColumn {
  static [entityKind] = "PgSmallSerial";
  getSQLType() {
    return "smallserial";
  }
};
function smallserial(name) {
  return new PgSmallSerialBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/text.js
var PgTextBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgTextBuilder";
  constructor(name, config) {
    super(name, "string", "PgText");
    this.config.enumValues = config.enum;
  }
  /** @internal */
  build(table) {
    return new PgText(table, this.config);
  }
};
var PgText = class extends PgColumn {
  static [entityKind] = "PgText";
  enumValues = this.config.enumValues;
  getSQLType() {
    return "text";
  }
};
function text(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgTextBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/time.js
var PgTimeBuilder = class extends PgDateColumnBaseBuilder {
  constructor(name, withTimezone, precision) {
    super(name, "string", "PgTime");
    this.withTimezone = withTimezone;
    this.precision = precision;
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  static [entityKind] = "PgTimeBuilder";
  /** @internal */
  build(table) {
    return new PgTime(table, this.config);
  }
};
var PgTime = class extends PgColumn {
  static [entityKind] = "PgTime";
  withTimezone;
  precision;
  constructor(table, config) {
    super(table, config);
    this.withTimezone = config.withTimezone;
    this.precision = config.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : `(${this.precision})`;
    return `time${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
};
function time(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgTimeBuilder(name, config.withTimezone ?? false, config.precision);
}

// node_modules/drizzle-orm/pg-core/columns/timestamp.js
var PgTimestampBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgTimestampBuilder";
  constructor(name, withTimezone, precision) {
    super(name, "date", "PgTimestamp");
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  /** @internal */
  build(table) {
    return new PgTimestamp(table, this.config);
  }
};
var PgTimestamp = class extends PgColumn {
  static [entityKind] = "PgTimestamp";
  withTimezone;
  precision;
  constructor(table, config) {
    super(table, config);
    this.withTimezone = config.withTimezone;
    this.precision = config.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : ` (${this.precision})`;
    return `timestamp${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") return new Date(this.withTimezone ? value : value + "+0000");
    return value;
  }
  mapToDriverValue = (value) => {
    return value.toISOString();
  };
};
var PgTimestampStringBuilder = class extends PgDateColumnBaseBuilder {
  static [entityKind] = "PgTimestampStringBuilder";
  constructor(name, withTimezone, precision) {
    super(name, "string", "PgTimestampString");
    this.config.withTimezone = withTimezone;
    this.config.precision = precision;
  }
  /** @internal */
  build(table) {
    return new PgTimestampString(
      table,
      this.config
    );
  }
};
var PgTimestampString = class extends PgColumn {
  static [entityKind] = "PgTimestampString";
  withTimezone;
  precision;
  constructor(table, config) {
    super(table, config);
    this.withTimezone = config.withTimezone;
    this.precision = config.precision;
  }
  getSQLType() {
    const precision = this.precision === void 0 ? "" : `(${this.precision})`;
    return `timestamp${precision}${this.withTimezone ? " with time zone" : ""}`;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") return value;
    const shortened = value.toISOString().slice(0, -1).replace("T", " ");
    if (this.withTimezone) {
      const offset = value.getTimezoneOffset();
      const sign = offset <= 0 ? "+" : "-";
      return `${shortened}${sign}${Math.floor(Math.abs(offset) / 60).toString().padStart(2, "0")}`;
    }
    return shortened;
  }
};
function timestamp(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config?.mode === "string") {
    return new PgTimestampStringBuilder(name, config.withTimezone ?? false, config.precision);
  }
  return new PgTimestampBuilder(name, config?.withTimezone ?? false, config?.precision);
}

// node_modules/drizzle-orm/pg-core/columns/uuid.js
var PgUUIDBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgUUIDBuilder";
  constructor(name) {
    super(name, "string", "PgUUID");
  }
  /**
   * Adds `default gen_random_uuid()` to the column definition.
   */
  defaultRandom() {
    return this.default(sql`gen_random_uuid()`);
  }
  /** @internal */
  build(table) {
    return new PgUUID(table, this.config);
  }
};
var PgUUID = class extends PgColumn {
  static [entityKind] = "PgUUID";
  getSQLType() {
    return "uuid";
  }
};
function uuid(name) {
  return new PgUUIDBuilder(name ?? "");
}

// node_modules/drizzle-orm/pg-core/columns/varchar.js
var PgVarcharBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgVarcharBuilder";
  constructor(name, config) {
    super(name, "string", "PgVarchar");
    this.config.length = config.length;
    this.config.enumValues = config.enum;
  }
  /** @internal */
  build(table) {
    return new PgVarchar(
      table,
      this.config
    );
  }
};
var PgVarchar = class extends PgColumn {
  static [entityKind] = "PgVarchar";
  length = this.config.length;
  enumValues = this.config.enumValues;
  getSQLType() {
    return this.length === void 0 ? `varchar` : `varchar(${this.length})`;
  }
};
function varchar(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgVarcharBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/vector_extension/bit.js
var PgBinaryVectorBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgBinaryVectorBuilder";
  constructor(name, config) {
    super(name, "string", "PgBinaryVector");
    this.config.dimensions = config.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgBinaryVector(
      table,
      this.config
    );
  }
};
var PgBinaryVector = class extends PgColumn {
  static [entityKind] = "PgBinaryVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `bit(${this.dimensions})`;
  }
};
function bit(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgBinaryVectorBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/vector_extension/halfvec.js
var PgHalfVectorBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgHalfVectorBuilder";
  constructor(name, config) {
    super(name, "array", "PgHalfVector");
    this.config.dimensions = config.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgHalfVector(
      table,
      this.config
    );
  }
};
var PgHalfVector = class extends PgColumn {
  static [entityKind] = "PgHalfVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `halfvec(${this.dimensions})`;
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    return value.slice(1, -1).split(",").map((v) => Number.parseFloat(v));
  }
};
function halfvec(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgHalfVectorBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/vector_extension/sparsevec.js
var PgSparseVectorBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgSparseVectorBuilder";
  constructor(name, config) {
    super(name, "string", "PgSparseVector");
    this.config.dimensions = config.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgSparseVector(
      table,
      this.config
    );
  }
};
var PgSparseVector = class extends PgColumn {
  static [entityKind] = "PgSparseVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `sparsevec(${this.dimensions})`;
  }
};
function sparsevec(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgSparseVectorBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/vector_extension/vector.js
var PgVectorBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgVectorBuilder";
  constructor(name, config) {
    super(name, "array", "PgVector");
    this.config.dimensions = config.dimensions;
  }
  /** @internal */
  build(table) {
    return new PgVector(
      table,
      this.config
    );
  }
};
var PgVector = class extends PgColumn {
  static [entityKind] = "PgVector";
  dimensions = this.config.dimensions;
  getSQLType() {
    return `vector(${this.dimensions})`;
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
  mapFromDriverValue(value) {
    return value.slice(1, -1).split(",").map((v) => Number.parseFloat(v));
  }
};
function vector(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgVectorBuilder(name, config);
}

// node_modules/drizzle-orm/pg-core/columns/all.js
function getPgColumnBuilders() {
  return {
    bigint,
    bigserial,
    boolean,
    char,
    cidr,
    customType,
    date,
    doublePrecision,
    inet,
    integer,
    interval,
    json,
    jsonb,
    line,
    macaddr,
    macaddr8,
    numeric,
    point,
    geometry,
    real,
    serial,
    smallint,
    smallserial,
    text,
    time,
    timestamp,
    uuid,
    varchar,
    bit,
    halfvec,
    sparsevec,
    vector
  };
}

// node_modules/drizzle-orm/pg-core/table.js
var InlineForeignKeys = Symbol.for("drizzle:PgInlineForeignKeys");
var EnableRLS = Symbol.for("drizzle:EnableRLS");
var PgTable = class extends Table {
  static [entityKind] = "PgTable";
  /** @internal */
  static Symbol = Object.assign({}, Table.Symbol, {
    InlineForeignKeys,
    EnableRLS
  });
  /**@internal */
  [InlineForeignKeys] = [];
  /** @internal */
  [EnableRLS] = false;
  /** @internal */
  [Table.Symbol.ExtraConfigBuilder] = void 0;
  /** @internal */
  [Table.Symbol.ExtraConfigColumns] = {};
};
function pgTableWithSchema(name, columns, extraConfig, schema2, baseName = name) {
  const rawTable = new PgTable(name, schema2, baseName);
  const parsedColumns = typeof columns === "function" ? columns(getPgColumnBuilders()) : columns;
  const builtColumns = Object.fromEntries(
    Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name2);
      const column = colBuilder.build(rawTable);
      rawTable[InlineForeignKeys].push(...colBuilder.buildForeignKeys(column, rawTable));
      return [name2, column];
    })
  );
  const builtColumnsForExtraConfig = Object.fromEntries(
    Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name2);
      const column = colBuilder.buildExtraConfigColumn(rawTable);
      return [name2, column];
    })
  );
  const table = Object.assign(rawTable, builtColumns);
  table[Table.Symbol.Columns] = builtColumns;
  table[Table.Symbol.ExtraConfigColumns] = builtColumnsForExtraConfig;
  if (extraConfig) {
    table[PgTable.Symbol.ExtraConfigBuilder] = extraConfig;
  }
  return Object.assign(table, {
    enableRLS: () => {
      table[PgTable.Symbol.EnableRLS] = true;
      return table;
    }
  });
}
var pgTable = (name, columns, extraConfig) => {
  return pgTableWithSchema(name, columns, extraConfig, void 0);
};

// node_modules/drizzle-orm/pg-core/primary-keys.js
function primaryKey(...config) {
  if (config[0].columns) {
    return new PrimaryKeyBuilder(config[0].columns, config[0].name);
  }
  return new PrimaryKeyBuilder(config);
}
var PrimaryKeyBuilder = class {
  static [entityKind] = "PgPrimaryKeyBuilder";
  /** @internal */
  columns;
  /** @internal */
  name;
  constructor(columns, name) {
    this.columns = columns;
    this.name = name;
  }
  /** @internal */
  build(table) {
    return new PrimaryKey(table, this.columns, this.name);
  }
};
var PrimaryKey = class {
  constructor(table, columns, name) {
    this.table = table;
    this.columns = columns;
    this.name = name;
  }
  static [entityKind] = "PgPrimaryKey";
  columns;
  name;
  getName() {
    return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
  }
};

// node_modules/drizzle-orm/sql/expressions/conditions.js
function bindIfParam(value, column) {
  if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View)) {
    return new Param(value, column);
  }
  return value;
}
var eq = (left, right) => {
  return sql`${left} = ${bindIfParam(right, left)}`;
};
var ne = (left, right) => {
  return sql`${left} <> ${bindIfParam(right, left)}`;
};
function and(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" and ")),
    new StringChunk(")")
  ]);
}
function or(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" or ")),
    new StringChunk(")")
  ]);
}
function not(condition) {
  return sql`not ${condition}`;
}
var gt = (left, right) => {
  return sql`${left} > ${bindIfParam(right, left)}`;
};
var gte = (left, right) => {
  return sql`${left} >= ${bindIfParam(right, left)}`;
};
var lt = (left, right) => {
  return sql`${left} < ${bindIfParam(right, left)}`;
};
var lte = (left, right) => {
  return sql`${left} <= ${bindIfParam(right, left)}`;
};
function inArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`false`;
    }
    return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} in ${bindIfParam(values, column)}`;
}
function notInArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`true`;
    }
    return sql`${column} not in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} not in ${bindIfParam(values, column)}`;
}
function isNull(value) {
  return sql`${value} is null`;
}
function isNotNull(value) {
  return sql`${value} is not null`;
}
function exists(subquery) {
  return sql`exists ${subquery}`;
}
function notExists(subquery) {
  return sql`not exists ${subquery}`;
}
function between(column, min, max) {
  return sql`${column} between ${bindIfParam(min, column)} and ${bindIfParam(
    max,
    column
  )}`;
}
function notBetween(column, min, max) {
  return sql`${column} not between ${bindIfParam(
    min,
    column
  )} and ${bindIfParam(max, column)}`;
}
function like(column, value) {
  return sql`${column} like ${value}`;
}
function notLike(column, value) {
  return sql`${column} not like ${value}`;
}
function ilike(column, value) {
  return sql`${column} ilike ${value}`;
}
function notIlike(column, value) {
  return sql`${column} not ilike ${value}`;
}

// node_modules/drizzle-orm/sql/expressions/select.js
function asc(column) {
  return sql`${column} asc`;
}
function desc(column) {
  return sql`${column} desc`;
}

// node_modules/drizzle-orm/relations.js
var Relation = class {
  constructor(sourceTable, referencedTable, relationName) {
    this.sourceTable = sourceTable;
    this.referencedTable = referencedTable;
    this.relationName = relationName;
    this.referencedTableName = referencedTable[Table.Symbol.Name];
  }
  static [entityKind] = "Relation";
  referencedTableName;
  fieldName;
};
var Relations = class {
  constructor(table, config) {
    this.table = table;
    this.config = config;
  }
  static [entityKind] = "Relations";
};
var One = class _One extends Relation {
  constructor(sourceTable, referencedTable, config, isNullable) {
    super(sourceTable, referencedTable, config?.relationName);
    this.config = config;
    this.isNullable = isNullable;
  }
  static [entityKind] = "One";
  withFieldName(fieldName) {
    const relation = new _One(
      this.sourceTable,
      this.referencedTable,
      this.config,
      this.isNullable
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
var Many = class _Many extends Relation {
  constructor(sourceTable, referencedTable, config) {
    super(sourceTable, referencedTable, config?.relationName);
    this.config = config;
  }
  static [entityKind] = "Many";
  withFieldName(fieldName) {
    const relation = new _Many(
      this.sourceTable,
      this.referencedTable,
      this.config
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
function getOperators() {
  return {
    and,
    between,
    eq,
    exists,
    gt,
    gte,
    ilike,
    inArray,
    isNull,
    isNotNull,
    like,
    lt,
    lte,
    ne,
    not,
    notBetween,
    notExists,
    notLike,
    notIlike,
    notInArray,
    or,
    sql
  };
}
function getOrderByOperators() {
  return {
    sql,
    asc,
    desc
  };
}
function extractTablesRelationalConfig(schema2, configHelpers) {
  if (Object.keys(schema2).length === 1 && "default" in schema2 && !is(schema2["default"], Table)) {
    schema2 = schema2["default"];
  }
  const tableNamesMap = {};
  const relationsBuffer = {};
  const tablesConfig = {};
  for (const [key, value] of Object.entries(schema2)) {
    if (is(value, Table)) {
      const dbName = getTableUniqueName(value);
      const bufferedRelations = relationsBuffer[dbName];
      tableNamesMap[dbName] = key;
      tablesConfig[key] = {
        tsName: key,
        dbName: value[Table.Symbol.Name],
        schema: value[Table.Symbol.Schema],
        columns: value[Table.Symbol.Columns],
        relations: bufferedRelations?.relations ?? {},
        primaryKey: bufferedRelations?.primaryKey ?? []
      };
      for (const column of Object.values(
        value[Table.Symbol.Columns]
      )) {
        if (column.primary) {
          tablesConfig[key].primaryKey.push(column);
        }
      }
      const extraConfig = value[Table.Symbol.ExtraConfigBuilder]?.(value[Table.Symbol.ExtraConfigColumns]);
      if (extraConfig) {
        for (const configEntry of Object.values(extraConfig)) {
          if (is(configEntry, PrimaryKeyBuilder)) {
            tablesConfig[key].primaryKey.push(...configEntry.columns);
          }
        }
      }
    } else if (is(value, Relations)) {
      const dbName = getTableUniqueName(value.table);
      const tableName = tableNamesMap[dbName];
      const relations2 = value.config(
        configHelpers(value.table)
      );
      let primaryKey2;
      for (const [relationName, relation] of Object.entries(relations2)) {
        if (tableName) {
          const tableConfig = tablesConfig[tableName];
          tableConfig.relations[relationName] = relation;
          if (primaryKey2) {
            tableConfig.primaryKey.push(...primaryKey2);
          }
        } else {
          if (!(dbName in relationsBuffer)) {
            relationsBuffer[dbName] = {
              relations: {},
              primaryKey: primaryKey2
            };
          }
          relationsBuffer[dbName].relations[relationName] = relation;
        }
      }
    }
  }
  return { tables: tablesConfig, tableNamesMap };
}
function createOne(sourceTable) {
  return function one(table, config) {
    return new One(
      sourceTable,
      table,
      config,
      config?.fields.reduce((res, f) => res && f.notNull, true) ?? false
    );
  };
}
function createMany(sourceTable) {
  return function many(referencedTable, config) {
    return new Many(sourceTable, referencedTable, config);
  };
}
function normalizeRelation(schema2, tableNamesMap, relation) {
  if (is(relation, One) && relation.config) {
    return {
      fields: relation.config.fields,
      references: relation.config.references
    };
  }
  const referencedTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
  if (!referencedTableTsName) {
    throw new Error(
      `Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const referencedTableConfig = schema2[referencedTableTsName];
  if (!referencedTableConfig) {
    throw new Error(`Table "${referencedTableTsName}" not found in schema`);
  }
  const sourceTable = relation.sourceTable;
  const sourceTableTsName = tableNamesMap[getTableUniqueName(sourceTable)];
  if (!sourceTableTsName) {
    throw new Error(
      `Table "${sourceTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const reverseRelations = [];
  for (const referencedTableRelation of Object.values(
    referencedTableConfig.relations
  )) {
    if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) {
      reverseRelations.push(referencedTableRelation);
    }
  }
  if (reverseRelations.length > 1) {
    throw relation.relationName ? new Error(
      `There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`
    ) : new Error(
      `There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`
    );
  }
  if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) {
    return {
      fields: reverseRelations[0].config.references,
      references: reverseRelations[0].config.fields
    };
  }
  throw new Error(
    `There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`
  );
}
function createTableRelationsHelpers(sourceTable) {
  return {
    one: createOne(sourceTable),
    many: createMany(sourceTable)
  };
}
function mapRelationalRow(tablesConfig, tableConfig, row, buildQueryResultSelection, mapColumnValue = (value) => value) {
  const result = {};
  for (const [
    selectionItemIndex,
    selectionItem
  ] of buildQueryResultSelection.entries()) {
    if (selectionItem.isJson) {
      const relation = tableConfig.relations[selectionItem.tsKey];
      const rawSubRows = row[selectionItemIndex];
      const subRows = typeof rawSubRows === "string" ? JSON.parse(rawSubRows) : rawSubRows;
      result[selectionItem.tsKey] = is(relation, One) ? subRows && mapRelationalRow(
        tablesConfig,
        tablesConfig[selectionItem.relationTableTsKey],
        subRows,
        selectionItem.selection,
        mapColumnValue
      ) : subRows.map(
        (subRow) => mapRelationalRow(
          tablesConfig,
          tablesConfig[selectionItem.relationTableTsKey],
          subRow,
          selectionItem.selection,
          mapColumnValue
        )
      );
    } else {
      const value = mapColumnValue(row[selectionItemIndex]);
      const field = selectionItem.field;
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      result[selectionItem.tsKey] = value === null ? null : decoder.mapFromDriverValue(value);
    }
  }
  return result;
}

// node_modules/drizzle-orm/node-postgres/driver.js
import pg2 from "pg";

// node_modules/drizzle-orm/selection-proxy.js
var SelectionProxyHandler = class _SelectionProxyHandler {
  static [entityKind] = "SelectionProxyHandler";
  config;
  constructor(config) {
    this.config = { ...config };
  }
  get(subquery, prop) {
    if (prop === "_") {
      return {
        ...subquery["_"],
        selectedFields: new Proxy(
          subquery._.selectedFields,
          this
        )
      };
    }
    if (prop === ViewBaseConfig) {
      return {
        ...subquery[ViewBaseConfig],
        selectedFields: new Proxy(
          subquery[ViewBaseConfig].selectedFields,
          this
        )
      };
    }
    if (typeof prop === "symbol") {
      return subquery[prop];
    }
    const columns = is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View) ? subquery[ViewBaseConfig].selectedFields : subquery;
    const value = columns[prop];
    if (is(value, SQL.Aliased)) {
      if (this.config.sqlAliasedBehavior === "sql" && !value.isSelectionField) {
        return value.sql;
      }
      const newValue = value.clone();
      newValue.isSelectionField = true;
      return newValue;
    }
    if (is(value, SQL)) {
      if (this.config.sqlBehavior === "sql") {
        return value;
      }
      throw new Error(
        `You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`
      );
    }
    if (is(value, Column)) {
      if (this.config.alias) {
        return new Proxy(
          value,
          new ColumnAliasProxyHandler(
            new Proxy(
              value.table,
              new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false)
            )
          )
        );
      }
      return value;
    }
    if (typeof value !== "object" || value === null) {
      return value;
    }
    return new Proxy(value, new _SelectionProxyHandler(this.config));
  }
};

// node_modules/drizzle-orm/pg-core/indexes.js
var IndexBuilderOn = class {
  constructor(unique, name) {
    this.unique = unique;
    this.name = name;
  }
  static [entityKind] = "PgIndexBuilderOn";
  on(...columns) {
    return new IndexBuilder(
      columns.map((it) => {
        if (is(it, SQL)) {
          return it;
        }
        it = it;
        const clonedIndexedColumn = new IndexedColumn(it.name, !!it.keyAsName, it.columnType, it.indexConfig);
        it.indexConfig = JSON.parse(JSON.stringify(it.defaultConfig));
        return clonedIndexedColumn;
      }),
      this.unique,
      false,
      this.name
    );
  }
  onOnly(...columns) {
    return new IndexBuilder(
      columns.map((it) => {
        if (is(it, SQL)) {
          return it;
        }
        it = it;
        const clonedIndexedColumn = new IndexedColumn(it.name, !!it.keyAsName, it.columnType, it.indexConfig);
        it.indexConfig = it.defaultConfig;
        return clonedIndexedColumn;
      }),
      this.unique,
      true,
      this.name
    );
  }
  /**
   * Specify what index method to use. Choices are `btree`, `hash`, `gist`, `spgist`, `gin`, `brin`, or user-installed access methods like `bloom`. The default method is `btree.
   *
   * If you have the `pg_vector` extension installed in your database, you can use the `hnsw` and `ivfflat` options, which are predefined types.
   *
   * **You can always specify any string you want in the method, in case Drizzle doesn't have it natively in its types**
   *
   * @param method The name of the index method to be used
   * @param columns
   * @returns
   */
  using(method, ...columns) {
    return new IndexBuilder(
      columns.map((it) => {
        if (is(it, SQL)) {
          return it;
        }
        it = it;
        const clonedIndexedColumn = new IndexedColumn(it.name, !!it.keyAsName, it.columnType, it.indexConfig);
        it.indexConfig = JSON.parse(JSON.stringify(it.defaultConfig));
        return clonedIndexedColumn;
      }),
      this.unique,
      true,
      this.name,
      method
    );
  }
};
var IndexBuilder = class {
  static [entityKind] = "PgIndexBuilder";
  /** @internal */
  config;
  constructor(columns, unique, only, name, method = "btree") {
    this.config = {
      name,
      columns,
      unique,
      only,
      method
    };
  }
  concurrently() {
    this.config.concurrently = true;
    return this;
  }
  with(obj) {
    this.config.with = obj;
    return this;
  }
  where(condition) {
    this.config.where = condition;
    return this;
  }
  /** @internal */
  build(table) {
    return new Index(this.config, table);
  }
};
var Index = class {
  static [entityKind] = "PgIndex";
  config;
  constructor(config, table) {
    this.config = { ...config, table };
  }
};
function index(name) {
  return new IndexBuilderOn(false, name);
}
function uniqueIndex(name) {
  return new IndexBuilderOn(true, name);
}

// node_modules/drizzle-orm/casing.js
function toSnakeCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.map((word) => word.toLowerCase()).join("_");
}
function toCamelCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.reduce((acc, word, i) => {
    const formattedWord = i === 0 ? word.toLowerCase() : `${word[0].toUpperCase()}${word.slice(1)}`;
    return acc + formattedWord;
  }, "");
}
function noopCase(input) {
  return input;
}
var CasingCache = class {
  static [entityKind] = "CasingCache";
  /** @internal */
  cache = {};
  cachedTables = {};
  convert;
  constructor(casing) {
    this.convert = casing === "snake_case" ? toSnakeCase : casing === "camelCase" ? toCamelCase : noopCase;
  }
  getColumnCasing(column) {
    if (!column.keyAsName) return column.name;
    const schema2 = column.table[Table.Symbol.Schema] ?? "public";
    const tableName = column.table[Table.Symbol.OriginalName];
    const key = `${schema2}.${tableName}.${column.name}`;
    if (!this.cache[key]) {
      this.cacheTable(column.table);
    }
    return this.cache[key];
  }
  cacheTable(table) {
    const schema2 = table[Table.Symbol.Schema] ?? "public";
    const tableName = table[Table.Symbol.OriginalName];
    const tableKey = `${schema2}.${tableName}`;
    if (!this.cachedTables[tableKey]) {
      for (const column of Object.values(table[Table.Symbol.Columns])) {
        const columnKey = `${tableKey}.${column.name}`;
        this.cache[columnKey] = this.convert(column.name);
      }
      this.cachedTables[tableKey] = true;
    }
  }
  clearCache() {
    this.cache = {};
    this.cachedTables = {};
  }
};

// node_modules/drizzle-orm/pg-core/view-base.js
var PgViewBase = class extends View {
  static [entityKind] = "PgViewBase";
};

// node_modules/drizzle-orm/pg-core/dialect.js
var PgDialect = class {
  static [entityKind] = "PgDialect";
  /** @internal */
  casing;
  constructor(config) {
    this.casing = new CasingCache(config?.casing);
  }
  async migrate(migrations, session, config) {
    const migrationsTable = typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
    const migrationsSchema = typeof config === "string" ? "drizzle" : config.migrationsSchema ?? "drizzle";
    const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`;
    await session.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(migrationsSchema)}`);
    await session.execute(migrationTableCreate);
    const dbMigrations = await session.all(
      sql`select id, hash, created_at from ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} order by created_at desc limit 1`
    );
    const lastDbMigration = dbMigrations[0];
    await session.transaction(async (tx) => {
      for await (const migration of migrations) {
        if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
          for (const stmt of migration.sql) {
            await tx.execute(sql.raw(stmt));
          }
          await tx.execute(
            sql`insert into ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} ("hash", "created_at") values(${migration.hash}, ${migration.folderMillis})`
          );
        }
      }
    });
  }
  escapeName(name) {
    return `"${name.replace(/"/g, '""')}"`;
  }
  escapeParam(num) {
    return `$${num + 1}`;
  }
  escapeString(str) {
    return `'${str.replace(/'/g, "''")}'`;
  }
  buildWithCTE(queries) {
    if (!queries?.length) return void 0;
    const withSqlChunks = [sql`with `];
    for (const [i, w] of queries.entries()) {
      withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
      if (i < queries.length - 1) {
        withSqlChunks.push(sql`, `);
      }
    }
    withSqlChunks.push(sql` `);
    return sql.join(withSqlChunks);
  }
  buildDeleteQuery({ table, where, returning, withList }) {
    const withSql = this.buildWithCTE(withList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}delete from ${table}${whereSql}${returningSql}`;
  }
  buildUpdateSet(table, set) {
    const tableColumns = table[Table.Symbol.Columns];
    const columnNames = Object.keys(tableColumns).filter(
      (colName) => set[colName] !== void 0 || tableColumns[colName]?.onUpdateFn !== void 0
    );
    const setSize = columnNames.length;
    return sql.join(columnNames.flatMap((colName, i) => {
      const col = tableColumns[colName];
      const onUpdateFnResult = col.onUpdateFn?.();
      const value = set[colName] ?? (is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col));
      const res = sql`${sql.identifier(this.casing.getColumnCasing(col))} = ${value}`;
      if (i < setSize - 1) {
        return [res, sql.raw(", ")];
      }
      return [res];
    }));
  }
  buildUpdateQuery({ table, set, where, returning, withList, from, joins }) {
    const withSql = this.buildWithCTE(withList);
    const tableName = table[PgTable.Symbol.Name];
    const tableSchema = table[PgTable.Symbol.Schema];
    const origTableName = table[PgTable.Symbol.OriginalName];
    const alias = tableName === origTableName ? void 0 : tableName;
    const tableSql = sql`${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}`;
    const setSql = this.buildUpdateSet(table, set);
    const fromSql = from && sql.join([sql.raw(" from "), this.buildFromTable(from)]);
    const joinsSql = this.buildJoins(joins);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: !from })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}update ${tableSql} set ${setSql}${fromSql}${joinsSql}${whereSql}${returningSql}`;
  }
  /**
   * Builds selection SQL with provided fields/expressions
   *
   * Examples:
   *
   * `select <selection> from`
   *
   * `insert ... returning <selection>`
   *
   * If `isSingleTable` is true, then columns won't be prefixed with table name
   */
  buildSelection(fields, { isSingleTable = false } = {}) {
    const columnsLen = fields.length;
    const chunks = fields.flatMap(({ field }, i) => {
      const chunk = [];
      if (is(field, SQL.Aliased) && field.isSelectionField) {
        chunk.push(sql.identifier(field.fieldAlias));
      } else if (is(field, SQL.Aliased) || is(field, SQL)) {
        const query = is(field, SQL.Aliased) ? field.sql : field;
        if (isSingleTable) {
          chunk.push(
            new SQL(
              query.queryChunks.map((c) => {
                if (is(c, PgColumn)) {
                  return sql.identifier(this.casing.getColumnCasing(c));
                }
                return c;
              })
            )
          );
        } else {
          chunk.push(query);
        }
        if (is(field, SQL.Aliased)) {
          chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
        }
      } else if (is(field, Column)) {
        if (isSingleTable) {
          chunk.push(sql.identifier(this.casing.getColumnCasing(field)));
        } else {
          chunk.push(field);
        }
      } else if (is(field, Subquery)) {
        const entries = Object.entries(field._.selectedFields);
        if (entries.length === 1) {
          const entry = entries[0][1];
          const fieldDecoder = is(entry, SQL) ? entry.decoder : is(entry, Column) ? { mapFromDriverValue: (v) => entry.mapFromDriverValue(v) } : entry.sql.decoder;
          if (fieldDecoder) {
            field._.sql.decoder = fieldDecoder;
          }
        }
        chunk.push(field);
      }
      if (i < columnsLen - 1) {
        chunk.push(sql`, `);
      }
      return chunk;
    });
    return sql.join(chunks);
  }
  buildJoins(joins) {
    if (!joins || joins.length === 0) {
      return void 0;
    }
    const joinsArray = [];
    for (const [index2, joinMeta] of joins.entries()) {
      if (index2 === 0) {
        joinsArray.push(sql` `);
      }
      const table = joinMeta.table;
      const lateralSql = joinMeta.lateral ? sql` lateral` : void 0;
      const onSql = joinMeta.on ? sql` on ${joinMeta.on}` : void 0;
      if (is(table, PgTable)) {
        const tableName = table[PgTable.Symbol.Name];
        const tableSchema = table[PgTable.Symbol.Schema];
        const origTableName = table[PgTable.Symbol.OriginalName];
        const alias = tableName === origTableName ? void 0 : joinMeta.alias;
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}${onSql}`
        );
      } else if (is(table, View)) {
        const viewName = table[ViewBaseConfig].name;
        const viewSchema = table[ViewBaseConfig].schema;
        const origViewName = table[ViewBaseConfig].originalName;
        const alias = viewName === origViewName ? void 0 : joinMeta.alias;
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${viewSchema ? sql`${sql.identifier(viewSchema)}.` : void 0}${sql.identifier(origViewName)}${alias && sql` ${sql.identifier(alias)}`}${onSql}`
        );
      } else {
        joinsArray.push(
          sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${table}${onSql}`
        );
      }
      if (index2 < joins.length - 1) {
        joinsArray.push(sql` `);
      }
    }
    return sql.join(joinsArray);
  }
  buildFromTable(table) {
    if (is(table, Table) && table[Table.Symbol.IsAlias]) {
      let fullName = sql`${sql.identifier(table[Table.Symbol.OriginalName])}`;
      if (table[Table.Symbol.Schema]) {
        fullName = sql`${sql.identifier(table[Table.Symbol.Schema])}.${fullName}`;
      }
      return sql`${fullName} ${sql.identifier(table[Table.Symbol.Name])}`;
    }
    return table;
  }
  buildSelectQuery({
    withList,
    fields,
    fieldsFlat,
    where,
    having,
    table,
    joins,
    orderBy,
    groupBy,
    limit,
    offset,
    lockingClause,
    distinct,
    setOperators
  }) {
    const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
    for (const f of fieldsList) {
      if (is(f.field, Column) && getTableName(f.field.table) !== (is(table, Subquery) ? table._.alias : is(table, PgViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : getTableName(table)) && !((table2) => joins?.some(
        ({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])
      ))(f.field.table)) {
        const tableName = getTableName(f.field.table);
        throw new Error(
          `Your "${f.path.join("->")}" field references a column "${tableName}"."${f.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`
        );
      }
    }
    const isSingleTable = !joins || joins.length === 0;
    const withSql = this.buildWithCTE(withList);
    let distinctSql;
    if (distinct) {
      distinctSql = distinct === true ? sql` distinct` : sql` distinct on (${sql.join(distinct.on, sql`, `)})`;
    }
    const selection = this.buildSelection(fieldsList, { isSingleTable });
    const tableSql = this.buildFromTable(table);
    const joinsSql = this.buildJoins(joins);
    const whereSql = where ? sql` where ${where}` : void 0;
    const havingSql = having ? sql` having ${having}` : void 0;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      orderBySql = sql` order by ${sql.join(orderBy, sql`, `)}`;
    }
    let groupBySql;
    if (groupBy && groupBy.length > 0) {
      groupBySql = sql` group by ${sql.join(groupBy, sql`, `)}`;
    }
    const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    const lockingClauseSql = sql.empty();
    if (lockingClause) {
      const clauseSql = sql` for ${sql.raw(lockingClause.strength)}`;
      if (lockingClause.config.of) {
        clauseSql.append(
          sql` of ${sql.join(
            Array.isArray(lockingClause.config.of) ? lockingClause.config.of : [lockingClause.config.of],
            sql`, `
          )}`
        );
      }
      if (lockingClause.config.noWait) {
        clauseSql.append(sql` nowait`);
      } else if (lockingClause.config.skipLocked) {
        clauseSql.append(sql` skip locked`);
      }
      lockingClauseSql.append(clauseSql);
    }
    const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}${lockingClauseSql}`;
    if (setOperators.length > 0) {
      return this.buildSetOperations(finalQuery, setOperators);
    }
    return finalQuery;
  }
  buildSetOperations(leftSelect, setOperators) {
    const [setOperator, ...rest] = setOperators;
    if (!setOperator) {
      throw new Error("Cannot pass undefined values to any set operator");
    }
    if (rest.length === 0) {
      return this.buildSetOperationQuery({ leftSelect, setOperator });
    }
    return this.buildSetOperations(
      this.buildSetOperationQuery({ leftSelect, setOperator }),
      rest
    );
  }
  buildSetOperationQuery({
    leftSelect,
    setOperator: { type, isAll, rightSelect, limit, orderBy, offset }
  }) {
    const leftChunk = sql`(${leftSelect.getSQL()}) `;
    const rightChunk = sql`(${rightSelect.getSQL()})`;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      const orderByValues = [];
      for (const singleOrderBy of orderBy) {
        if (is(singleOrderBy, PgColumn)) {
          orderByValues.push(sql.identifier(singleOrderBy.name));
        } else if (is(singleOrderBy, SQL)) {
          for (let i = 0; i < singleOrderBy.queryChunks.length; i++) {
            const chunk = singleOrderBy.queryChunks[i];
            if (is(chunk, PgColumn)) {
              singleOrderBy.queryChunks[i] = sql.identifier(chunk.name);
            }
          }
          orderByValues.push(sql`${singleOrderBy}`);
        } else {
          orderByValues.push(sql`${singleOrderBy}`);
        }
      }
      orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)} `;
    }
    const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
    const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
  }
  buildInsertQuery({ table, values: valuesOrSelect, onConflict, returning, withList, select, overridingSystemValue_ }) {
    const valuesSqlList = [];
    const columns = table[Table.Symbol.Columns];
    const colEntries = Object.entries(columns).filter(([_, col]) => !col.shouldDisableInsert());
    const insertOrder = colEntries.map(
      ([, column]) => sql.identifier(this.casing.getColumnCasing(column))
    );
    if (select) {
      const select2 = valuesOrSelect;
      if (is(select2, SQL)) {
        valuesSqlList.push(select2);
      } else {
        valuesSqlList.push(select2.getSQL());
      }
    } else {
      const values = valuesOrSelect;
      valuesSqlList.push(sql.raw("values "));
      for (const [valueIndex, value] of values.entries()) {
        const valueList = [];
        for (const [fieldName, col] of colEntries) {
          const colValue = value[fieldName];
          if (colValue === void 0 || is(colValue, Param) && colValue.value === void 0) {
            if (col.defaultFn !== void 0) {
              const defaultFnResult = col.defaultFn();
              const defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
              valueList.push(defaultValue);
            } else if (!col.default && col.onUpdateFn !== void 0) {
              const onUpdateFnResult = col.onUpdateFn();
              const newValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
              valueList.push(newValue);
            } else {
              valueList.push(sql`default`);
            }
          } else {
            valueList.push(colValue);
          }
        }
        valuesSqlList.push(valueList);
        if (valueIndex < values.length - 1) {
          valuesSqlList.push(sql`, `);
        }
      }
    }
    const withSql = this.buildWithCTE(withList);
    const valuesSql = sql.join(valuesSqlList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const onConflictSql = onConflict ? sql` on conflict ${onConflict}` : void 0;
    const overridingSql = overridingSystemValue_ === true ? sql`overriding system value ` : void 0;
    return sql`${withSql}insert into ${table} ${insertOrder} ${overridingSql}${valuesSql}${onConflictSql}${returningSql}`;
  }
  buildRefreshMaterializedViewQuery({ view, concurrently, withNoData }) {
    const concurrentlySql = concurrently ? sql` concurrently` : void 0;
    const withNoDataSql = withNoData ? sql` with no data` : void 0;
    return sql`refresh materialized view${concurrentlySql} ${view}${withNoDataSql}`;
  }
  prepareTyping(encoder) {
    if (is(encoder, PgJsonb) || is(encoder, PgJson)) {
      return "json";
    } else if (is(encoder, PgNumeric)) {
      return "decimal";
    } else if (is(encoder, PgTime)) {
      return "time";
    } else if (is(encoder, PgTimestamp) || is(encoder, PgTimestampString)) {
      return "timestamp";
    } else if (is(encoder, PgDate) || is(encoder, PgDateString)) {
      return "date";
    } else if (is(encoder, PgUUID)) {
      return "uuid";
    } else {
      return "none";
    }
  }
  sqlToQuery(sql2, invokeSource) {
    return sql2.toQuery({
      casing: this.casing,
      escapeName: this.escapeName,
      escapeParam: this.escapeParam,
      escapeString: this.escapeString,
      prepareTyping: this.prepareTyping,
      invokeSource
    });
  }
  // buildRelationalQueryWithPK({
  // 	fullSchema,
  // 	schema,
  // 	tableNamesMap,
  // 	table,
  // 	tableConfig,
  // 	queryConfig: config,
  // 	tableAlias,
  // 	isRoot = false,
  // 	joinOn,
  // }: {
  // 	fullSchema: Record<string, unknown>;
  // 	schema: TablesRelationalConfig;
  // 	tableNamesMap: Record<string, string>;
  // 	table: PgTable;
  // 	tableConfig: TableRelationalConfig;
  // 	queryConfig: true | DBQueryConfig<'many', true>;
  // 	tableAlias: string;
  // 	isRoot?: boolean;
  // 	joinOn?: SQL;
  // }): BuildRelationalQueryResult<PgTable, PgColumn> {
  // 	// For { "<relation>": true }, return a table with selection of all columns
  // 	if (config === true) {
  // 		const selectionEntries = Object.entries(tableConfig.columns);
  // 		const selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = selectionEntries.map((
  // 			[key, value],
  // 		) => ({
  // 			dbKey: value.name,
  // 			tsKey: key,
  // 			field: value as PgColumn,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 		return {
  // 			tableTsKey: tableConfig.tsName,
  // 			sql: table,
  // 			selection,
  // 		};
  // 	}
  // 	// let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
  // 	// let selectionForBuild = selection;
  // 	const aliasedColumns = Object.fromEntries(
  // 		Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)]),
  // 	);
  // 	const aliasedRelations = Object.fromEntries(
  // 		Object.entries(tableConfig.relations).map(([key, value]) => [key, aliasedRelation(value, tableAlias)]),
  // 	);
  // 	const aliasedFields = Object.assign({}, aliasedColumns, aliasedRelations);
  // 	let where, hasUserDefinedWhere;
  // 	if (config.where) {
  // 		const whereSql = typeof config.where === 'function' ? config.where(aliasedFields, operators) : config.where;
  // 		where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
  // 		hasUserDefinedWhere = !!where;
  // 	}
  // 	where = and(joinOn, where);
  // 	// const fieldsSelection: { tsKey: string; value: PgColumn | SQL.Aliased; isExtra?: boolean }[] = [];
  // 	let joins: Join[] = [];
  // 	let selectedColumns: string[] = [];
  // 	// Figure out which columns to select
  // 	if (config.columns) {
  // 		let isIncludeMode = false;
  // 		for (const [field, value] of Object.entries(config.columns)) {
  // 			if (value === undefined) {
  // 				continue;
  // 			}
  // 			if (field in tableConfig.columns) {
  // 				if (!isIncludeMode && value === true) {
  // 					isIncludeMode = true;
  // 				}
  // 				selectedColumns.push(field);
  // 			}
  // 		}
  // 		if (selectedColumns.length > 0) {
  // 			selectedColumns = isIncludeMode
  // 				? selectedColumns.filter((c) => config.columns?.[c] === true)
  // 				: Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
  // 		}
  // 	} else {
  // 		// Select all columns if selection is not specified
  // 		selectedColumns = Object.keys(tableConfig.columns);
  // 	}
  // 	// for (const field of selectedColumns) {
  // 	// 	const column = tableConfig.columns[field]! as PgColumn;
  // 	// 	fieldsSelection.push({ tsKey: field, value: column });
  // 	// }
  // 	let initiallySelectedRelations: {
  // 		tsKey: string;
  // 		queryConfig: true | DBQueryConfig<'many', false>;
  // 		relation: Relation;
  // 	}[] = [];
  // 	// let selectedRelations: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
  // 	// Figure out which relations to select
  // 	if (config.with) {
  // 		initiallySelectedRelations = Object.entries(config.with)
  // 			.filter((entry): entry is [typeof entry[0], NonNullable<typeof entry[1]>] => !!entry[1])
  // 			.map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey]! }));
  // 	}
  // 	const manyRelations = initiallySelectedRelations.filter((r) =>
  // 		is(r.relation, Many)
  // 		&& (schema[tableNamesMap[r.relation.referencedTable[Table.Symbol.Name]]!]?.primaryKey.length ?? 0) > 0
  // 	);
  // 	// If this is the last Many relation (or there are no Many relations), we are on the innermost subquery level
  // 	const isInnermostQuery = manyRelations.length < 2;
  // 	const selectedExtras: {
  // 		tsKey: string;
  // 		value: SQL.Aliased;
  // 	}[] = [];
  // 	// Figure out which extras to select
  // 	if (isInnermostQuery && config.extras) {
  // 		const extras = typeof config.extras === 'function'
  // 			? config.extras(aliasedFields, { sql })
  // 			: config.extras;
  // 		for (const [tsKey, value] of Object.entries(extras)) {
  // 			selectedExtras.push({
  // 				tsKey,
  // 				value: mapColumnsInAliasedSQLToAlias(value, tableAlias),
  // 			});
  // 		}
  // 	}
  // 	// Transform `fieldsSelection` into `selection`
  // 	// `fieldsSelection` shouldn't be used after this point
  // 	// for (const { tsKey, value, isExtra } of fieldsSelection) {
  // 	// 	selection.push({
  // 	// 		dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey]!.name,
  // 	// 		tsKey,
  // 	// 		field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
  // 	// 		relationTableTsKey: undefined,
  // 	// 		isJson: false,
  // 	// 		isExtra,
  // 	// 		selection: [],
  // 	// 	});
  // 	// }
  // 	let orderByOrig = typeof config.orderBy === 'function'
  // 		? config.orderBy(aliasedFields, orderByOperators)
  // 		: config.orderBy ?? [];
  // 	if (!Array.isArray(orderByOrig)) {
  // 		orderByOrig = [orderByOrig];
  // 	}
  // 	const orderBy = orderByOrig.map((orderByValue) => {
  // 		if (is(orderByValue, Column)) {
  // 			return aliasedTableColumn(orderByValue, tableAlias) as PgColumn;
  // 		}
  // 		return mapColumnsInSQLToAlias(orderByValue, tableAlias);
  // 	});
  // 	const limit = isInnermostQuery ? config.limit : undefined;
  // 	const offset = isInnermostQuery ? config.offset : undefined;
  // 	// For non-root queries without additional config except columns, return a table with selection
  // 	if (
  // 		!isRoot
  // 		&& initiallySelectedRelations.length === 0
  // 		&& selectedExtras.length === 0
  // 		&& !where
  // 		&& orderBy.length === 0
  // 		&& limit === undefined
  // 		&& offset === undefined
  // 	) {
  // 		return {
  // 			tableTsKey: tableConfig.tsName,
  // 			sql: table,
  // 			selection: selectedColumns.map((key) => ({
  // 				dbKey: tableConfig.columns[key]!.name,
  // 				tsKey: key,
  // 				field: tableConfig.columns[key] as PgColumn,
  // 				relationTableTsKey: undefined,
  // 				isJson: false,
  // 				selection: [],
  // 			})),
  // 		};
  // 	}
  // 	const selectedRelationsWithoutPK:
  // 	// Process all relations without primary keys, because they need to be joined differently and will all be on the same query level
  // 	for (
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationConfigValue,
  // 			relation,
  // 		} of initiallySelectedRelations
  // 	) {
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTable = schema[relationTableTsName]!;
  // 		if (relationTable.primaryKey.length > 0) {
  // 			continue;
  // 		}
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelation = this.buildRelationalQueryWithoutPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationConfigValue,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 			nestedQueryRelation: relation,
  // 		});
  // 		const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier('data')}`.as(selectedRelationTsKey);
  // 		joins.push({
  // 			on: sql`true`,
  // 			table: new Subquery(builtRelation.sql as SQL, {}, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: true,
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelation.selection,
  // 		});
  // 	}
  // 	const oneRelations = initiallySelectedRelations.filter((r): r is typeof r & { relation: One } =>
  // 		is(r.relation, One)
  // 	);
  // 	// Process all One relations with PKs, because they can all be joined on the same level
  // 	for (
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationConfigValue,
  // 			relation,
  // 		} of oneRelations
  // 	) {
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const relationTable = schema[relationTableTsName]!;
  // 		if (relationTable.primaryKey.length === 0) {
  // 			continue;
  // 		}
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelation = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationConfigValue,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 		});
  // 		const field = sql`case when ${sql.identifier(relationTableAlias)} is null then null else json_build_array(${
  // 			sql.join(
  // 				builtRelation.selection.map(({ field }) =>
  // 					is(field, SQL.Aliased)
  // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
  // 						: is(field, Column)
  // 						? aliasedTableColumn(field, relationTableAlias)
  // 						: field
  // 				),
  // 				sql`, `,
  // 			)
  // 		}) end`.as(selectedRelationTsKey);
  // 		const isLateralJoin = is(builtRelation.sql, SQL);
  // 		joins.push({
  // 			on: isLateralJoin ? sql`true` : joinOn,
  // 			table: is(builtRelation.sql, SQL)
  // 				? new Subquery(builtRelation.sql, {}, relationTableAlias)
  // 				: aliasedTable(builtRelation.sql, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: is(builtRelation.sql, SQL),
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelation.selection,
  // 		});
  // 	}
  // 	let distinct: PgSelectConfig['distinct'];
  // 	let tableFrom: PgTable | Subquery = table;
  // 	// Process first Many relation - each one requires a nested subquery
  // 	const manyRelation = manyRelations[0];
  // 	if (manyRelation) {
  // 		const {
  // 			tsKey: selectedRelationTsKey,
  // 			queryConfig: selectedRelationQueryConfig,
  // 			relation,
  // 		} = manyRelation;
  // 		distinct = {
  // 			on: tableConfig.primaryKey.map((c) => aliasedTableColumn(c as PgColumn, tableAlias)),
  // 		};
  // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
  // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
  // 		const relationTableTsName = tableNamesMap[relationTableName]!;
  // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
  // 		const joinOn = and(
  // 			...normalizedRelation.fields.map((field, i) =>
  // 				eq(
  // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
  // 					aliasedTableColumn(field, tableAlias),
  // 				)
  // 			),
  // 		);
  // 		const builtRelationJoin = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table: fullSchema[relationTableTsName] as PgTable,
  // 			tableConfig: schema[relationTableTsName]!,
  // 			queryConfig: selectedRelationQueryConfig,
  // 			tableAlias: relationTableAlias,
  // 			joinOn,
  // 		});
  // 		const builtRelationSelectionField = sql`case when ${
  // 			sql.identifier(relationTableAlias)
  // 		} is null then '[]' else json_agg(json_build_array(${
  // 			sql.join(
  // 				builtRelationJoin.selection.map(({ field }) =>
  // 					is(field, SQL.Aliased)
  // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
  // 						: is(field, Column)
  // 						? aliasedTableColumn(field, relationTableAlias)
  // 						: field
  // 				),
  // 				sql`, `,
  // 			)
  // 		})) over (partition by ${sql.join(distinct.on, sql`, `)}) end`.as(selectedRelationTsKey);
  // 		const isLateralJoin = is(builtRelationJoin.sql, SQL);
  // 		joins.push({
  // 			on: isLateralJoin ? sql`true` : joinOn,
  // 			table: isLateralJoin
  // 				? new Subquery(builtRelationJoin.sql as SQL, {}, relationTableAlias)
  // 				: aliasedTable(builtRelationJoin.sql as PgTable, relationTableAlias),
  // 			alias: relationTableAlias,
  // 			joinType: 'left',
  // 			lateral: isLateralJoin,
  // 		});
  // 		// Build the "from" subquery with the remaining Many relations
  // 		const builtTableFrom = this.buildRelationalQueryWithPK({
  // 			fullSchema,
  // 			schema,
  // 			tableNamesMap,
  // 			table,
  // 			tableConfig,
  // 			queryConfig: {
  // 				...config,
  // 				where: undefined,
  // 				orderBy: undefined,
  // 				limit: undefined,
  // 				offset: undefined,
  // 				with: manyRelations.slice(1).reduce<NonNullable<typeof config['with']>>(
  // 					(result, { tsKey, queryConfig: configValue }) => {
  // 						result[tsKey] = configValue;
  // 						return result;
  // 					},
  // 					{},
  // 				),
  // 			},
  // 			tableAlias,
  // 		});
  // 		selectedRelations.push({
  // 			dbKey: selectedRelationTsKey,
  // 			tsKey: selectedRelationTsKey,
  // 			field: builtRelationSelectionField,
  // 			relationTableTsKey: relationTableTsName,
  // 			isJson: true,
  // 			selection: builtRelationJoin.selection,
  // 		});
  // 		// selection = builtTableFrom.selection.map((item) =>
  // 		// 	is(item.field, SQL.Aliased)
  // 		// 		? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
  // 		// 		: item
  // 		// );
  // 		// selectionForBuild = [{
  // 		// 	dbKey: '*',
  // 		// 	tsKey: '*',
  // 		// 	field: sql`${sql.identifier(tableAlias)}.*`,
  // 		// 	selection: [],
  // 		// 	isJson: false,
  // 		// 	relationTableTsKey: undefined,
  // 		// }];
  // 		// const newSelectionItem: (typeof selection)[number] = {
  // 		// 	dbKey: selectedRelationTsKey,
  // 		// 	tsKey: selectedRelationTsKey,
  // 		// 	field,
  // 		// 	relationTableTsKey: relationTableTsName,
  // 		// 	isJson: true,
  // 		// 	selection: builtRelationJoin.selection,
  // 		// };
  // 		// selection.push(newSelectionItem);
  // 		// selectionForBuild.push(newSelectionItem);
  // 		tableFrom = is(builtTableFrom.sql, PgTable)
  // 			? builtTableFrom.sql
  // 			: new Subquery(builtTableFrom.sql, {}, tableAlias);
  // 	}
  // 	if (selectedColumns.length === 0 && selectedRelations.length === 0 && selectedExtras.length === 0) {
  // 		throw new DrizzleError(`No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")`);
  // 	}
  // 	let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'];
  // 	function prepareSelectedColumns() {
  // 		return selectedColumns.map((key) => ({
  // 			dbKey: tableConfig.columns[key]!.name,
  // 			tsKey: key,
  // 			field: tableConfig.columns[key] as PgColumn,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 	}
  // 	function prepareSelectedExtras() {
  // 		return selectedExtras.map((item) => ({
  // 			dbKey: item.value.fieldAlias,
  // 			tsKey: item.tsKey,
  // 			field: item.value,
  // 			relationTableTsKey: undefined,
  // 			isJson: false,
  // 			selection: [],
  // 		}));
  // 	}
  // 	if (isRoot) {
  // 		selection = [
  // 			...prepareSelectedColumns(),
  // 			...prepareSelectedExtras(),
  // 		];
  // 	}
  // 	if (hasUserDefinedWhere || orderBy.length > 0) {
  // 		tableFrom = new Subquery(
  // 			this.buildSelectQuery({
  // 				table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
  // 				fields: {},
  // 				fieldsFlat: selectionForBuild.map(({ field }) => ({
  // 					path: [],
  // 					field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
  // 				})),
  // 				joins,
  // 				distinct,
  // 			}),
  // 			{},
  // 			tableAlias,
  // 		);
  // 		selectionForBuild = selection.map((item) =>
  // 			is(item.field, SQL.Aliased)
  // 				? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
  // 				: item
  // 		);
  // 		joins = [];
  // 		distinct = undefined;
  // 	}
  // 	const result = this.buildSelectQuery({
  // 		table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
  // 		fields: {},
  // 		fieldsFlat: selectionForBuild.map(({ field }) => ({
  // 			path: [],
  // 			field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
  // 		})),
  // 		where,
  // 		limit,
  // 		offset,
  // 		joins,
  // 		orderBy,
  // 		distinct,
  // 	});
  // 	return {
  // 		tableTsKey: tableConfig.tsName,
  // 		sql: result,
  // 		selection,
  // 	};
  // }
  buildRelationalQueryWithoutPK({
    fullSchema,
    schema: schema2,
    tableNamesMap,
    table,
    tableConfig,
    queryConfig: config,
    tableAlias,
    nestedQueryRelation,
    joinOn
  }) {
    let selection = [];
    let limit, offset, orderBy = [], where;
    const joins = [];
    if (config === true) {
      const selectionEntries = Object.entries(tableConfig.columns);
      selection = selectionEntries.map(([key, value]) => ({
        dbKey: value.name,
        tsKey: key,
        field: aliasedTableColumn(value, tableAlias),
        relationTableTsKey: void 0,
        isJson: false,
        selection: []
      }));
    } else {
      const aliasedColumns = Object.fromEntries(
        Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)])
      );
      if (config.where) {
        const whereSql = typeof config.where === "function" ? config.where(aliasedColumns, getOperators()) : config.where;
        where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
      }
      const fieldsSelection = [];
      let selectedColumns = [];
      if (config.columns) {
        let isIncludeMode = false;
        for (const [field, value] of Object.entries(config.columns)) {
          if (value === void 0) {
            continue;
          }
          if (field in tableConfig.columns) {
            if (!isIncludeMode && value === true) {
              isIncludeMode = true;
            }
            selectedColumns.push(field);
          }
        }
        if (selectedColumns.length > 0) {
          selectedColumns = isIncludeMode ? selectedColumns.filter((c) => config.columns?.[c] === true) : Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
        }
      } else {
        selectedColumns = Object.keys(tableConfig.columns);
      }
      for (const field of selectedColumns) {
        const column = tableConfig.columns[field];
        fieldsSelection.push({ tsKey: field, value: column });
      }
      let selectedRelations = [];
      if (config.with) {
        selectedRelations = Object.entries(config.with).filter((entry) => !!entry[1]).map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey] }));
      }
      let extras;
      if (config.extras) {
        extras = typeof config.extras === "function" ? config.extras(aliasedColumns, { sql }) : config.extras;
        for (const [tsKey, value] of Object.entries(extras)) {
          fieldsSelection.push({
            tsKey,
            value: mapColumnsInAliasedSQLToAlias(value, tableAlias)
          });
        }
      }
      for (const { tsKey, value } of fieldsSelection) {
        selection.push({
          dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey].name,
          tsKey,
          field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
          relationTableTsKey: void 0,
          isJson: false,
          selection: []
        });
      }
      let orderByOrig = typeof config.orderBy === "function" ? config.orderBy(aliasedColumns, getOrderByOperators()) : config.orderBy ?? [];
      if (!Array.isArray(orderByOrig)) {
        orderByOrig = [orderByOrig];
      }
      orderBy = orderByOrig.map((orderByValue) => {
        if (is(orderByValue, Column)) {
          return aliasedTableColumn(orderByValue, tableAlias);
        }
        return mapColumnsInSQLToAlias(orderByValue, tableAlias);
      });
      limit = config.limit;
      offset = config.offset;
      for (const {
        tsKey: selectedRelationTsKey,
        queryConfig: selectedRelationConfigValue,
        relation
      } of selectedRelations) {
        const normalizedRelation = normalizeRelation(schema2, tableNamesMap, relation);
        const relationTableName = getTableUniqueName(relation.referencedTable);
        const relationTableTsName = tableNamesMap[relationTableName];
        const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
        const joinOn2 = and(
          ...normalizedRelation.fields.map(
            (field2, i) => eq(
              aliasedTableColumn(normalizedRelation.references[i], relationTableAlias),
              aliasedTableColumn(field2, tableAlias)
            )
          )
        );
        const builtRelation = this.buildRelationalQueryWithoutPK({
          fullSchema,
          schema: schema2,
          tableNamesMap,
          table: fullSchema[relationTableTsName],
          tableConfig: schema2[relationTableTsName],
          queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : { ...selectedRelationConfigValue, limit: 1 } : selectedRelationConfigValue,
          tableAlias: relationTableAlias,
          joinOn: joinOn2,
          nestedQueryRelation: relation
        });
        const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier("data")}`.as(selectedRelationTsKey);
        joins.push({
          on: sql`true`,
          table: new Subquery(builtRelation.sql, {}, relationTableAlias),
          alias: relationTableAlias,
          joinType: "left",
          lateral: true
        });
        selection.push({
          dbKey: selectedRelationTsKey,
          tsKey: selectedRelationTsKey,
          field,
          relationTableTsKey: relationTableTsName,
          isJson: true,
          selection: builtRelation.selection
        });
      }
    }
    if (selection.length === 0) {
      throw new DrizzleError({ message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")` });
    }
    let result;
    where = and(joinOn, where);
    if (nestedQueryRelation) {
      let field = sql`json_build_array(${sql.join(
        selection.map(
          ({ field: field2, tsKey, isJson }) => isJson ? sql`${sql.identifier(`${tableAlias}_${tsKey}`)}.${sql.identifier("data")}` : is(field2, SQL.Aliased) ? field2.sql : field2
        ),
        sql`, `
      )})`;
      if (is(nestedQueryRelation, Many)) {
        field = sql`coalesce(json_agg(${field}${orderBy.length > 0 ? sql` order by ${sql.join(orderBy, sql`, `)}` : void 0}), '[]'::json)`;
      }
      const nestedSelection = [{
        dbKey: "data",
        tsKey: "data",
        field: field.as("data"),
        isJson: true,
        relationTableTsKey: tableConfig.tsName,
        selection
      }];
      const needsSubquery = limit !== void 0 || offset !== void 0 || orderBy.length > 0;
      if (needsSubquery) {
        result = this.buildSelectQuery({
          table: aliasedTable(table, tableAlias),
          fields: {},
          fieldsFlat: [{
            path: [],
            field: sql.raw("*")
          }],
          where,
          limit,
          offset,
          orderBy,
          setOperators: []
        });
        where = void 0;
        limit = void 0;
        offset = void 0;
        orderBy = [];
      } else {
        result = aliasedTable(table, tableAlias);
      }
      result = this.buildSelectQuery({
        table: is(result, PgTable) ? result : new Subquery(result, {}, tableAlias),
        fields: {},
        fieldsFlat: nestedSelection.map(({ field: field2 }) => ({
          path: [],
          field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    } else {
      result = this.buildSelectQuery({
        table: aliasedTable(table, tableAlias),
        fields: {},
        fieldsFlat: selection.map(({ field }) => ({
          path: [],
          field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    }
    return {
      tableTsKey: tableConfig.tsName,
      sql: result,
      selection
    };
  }
};

// node_modules/drizzle-orm/query-builders/query-builder.js
var TypedQueryBuilder = class {
  static [entityKind] = "TypedQueryBuilder";
  /** @internal */
  getSelectedFields() {
    return this._.selectedFields;
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/select.js
var PgSelectBuilder = class {
  static [entityKind] = "PgSelectBuilder";
  fields;
  session;
  dialect;
  withList = [];
  distinct;
  constructor(config) {
    this.fields = config.fields;
    this.session = config.session;
    this.dialect = config.dialect;
    if (config.withList) {
      this.withList = config.withList;
    }
    this.distinct = config.distinct;
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  /**
   * Specify the table, subquery, or other target that you're
   * building a select query against.
   *
   * {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FROM | Postgres from documentation}
   */
  from(source) {
    const isPartialSelect = !!this.fields;
    const src = source;
    let fields;
    if (this.fields) {
      fields = this.fields;
    } else if (is(src, Subquery)) {
      fields = Object.fromEntries(
        Object.keys(src._.selectedFields).map((key) => [key, src[key]])
      );
    } else if (is(src, PgViewBase)) {
      fields = src[ViewBaseConfig].selectedFields;
    } else if (is(src, SQL)) {
      fields = {};
    } else {
      fields = getTableColumns(src);
    }
    return new PgSelectBase({
      table: src,
      fields,
      isPartialSelect,
      session: this.session,
      dialect: this.dialect,
      withList: this.withList,
      distinct: this.distinct
    }).setToken(this.authToken);
  }
};
var PgSelectQueryBuilderBase = class extends TypedQueryBuilder {
  static [entityKind] = "PgSelectQueryBuilder";
  _;
  config;
  joinsNotNullableMap;
  tableName;
  isPartialSelect;
  session;
  dialect;
  cacheConfig = void 0;
  usedTables = /* @__PURE__ */ new Set();
  constructor({ table, fields, isPartialSelect, session, dialect, withList, distinct }) {
    super();
    this.config = {
      withList,
      table,
      fields: { ...fields },
      distinct,
      setOperators: []
    };
    this.isPartialSelect = isPartialSelect;
    this.session = session;
    this.dialect = dialect;
    this._ = {
      selectedFields: fields,
      config: this.config
    };
    this.tableName = getTableLikeName(table);
    this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
    for (const item of extractUsedTable(table)) this.usedTables.add(item);
  }
  /** @internal */
  getUsedTables() {
    return [...this.usedTables];
  }
  createJoin(joinType, lateral) {
    return (table, on) => {
      const baseTableName = this.tableName;
      const tableName = getTableLikeName(table);
      for (const item of extractUsedTable(table)) this.usedTables.add(item);
      if (typeof tableName === "string" && this.config.joins?.some((join) => join.alias === tableName)) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (!this.isPartialSelect) {
        if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") {
          this.config.fields = {
            [baseTableName]: this.config.fields
          };
        }
        if (typeof tableName === "string" && !is(table, SQL)) {
          const selection = is(table, Subquery) ? table._.selectedFields : is(table, View) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
          this.config.fields[tableName] = selection;
        }
      }
      if (typeof on === "function") {
        on = on(
          new Proxy(
            this.config.fields,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      if (!this.config.joins) {
        this.config.joins = [];
      }
      this.config.joins.push({ on, table, joinType, alias: tableName, lateral });
      if (typeof tableName === "string") {
        switch (joinType) {
          case "left": {
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
          case "right": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "cross":
          case "inner": {
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "full": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
        }
      }
      return this;
    };
  }
  /**
   * Executes a `left join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#left-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet | null; }[] = await db.select()
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number | null; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  leftJoin = this.createJoin("left", false);
  /**
   * Executes a `left join lateral` operation by adding subquery to the current query.
   *
   * A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
   *
   * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#left-join-lateral}
   *
   * @param table the subquery to join.
   * @param on the `on` clause.
   */
  leftJoinLateral = this.createJoin("left", true);
  /**
   * Executes a `right join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the joined table with the corresponding row from the main table, if a match is found. If no matching row exists, it sets all columns of the main table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#right-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet; }[] = await db.select()
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  rightJoin = this.createJoin("right", false);
  /**
   * Executes an `inner join` operation, creating a new table by combining rows from two tables that have matching values.
   *
   * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  innerJoin = this.createJoin("inner", false);
  /**
   * Executes an `inner join lateral` operation, creating a new table by combining rows from two queries that have matching values.
   *
   * A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
   *
   * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join-lateral}
   *
   * @param table the subquery to join.
   * @param on the `on` clause.
   */
  innerJoinLateral = this.createJoin("inner", true);
  /**
   * Executes a `full join` operation by combining rows from two tables into a new table.
   *
   * Calling this method retrieves all rows from both main and joined tables, merging rows with matching values and filling in `null` for non-matching columns.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#full-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet | null; }[] = await db.select()
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number | null; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  fullJoin = this.createJoin("full", false);
  /**
   * Executes a `cross join` operation by combining rows from two tables into a new table.
   *
   * Calling this method retrieves all rows from both main and joined tables, merging all rows from each table.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#cross-join}
   *
   * @param table the table to join.
   *
   * @example
   *
   * ```ts
   * // Select all users, each user with every pet
   * const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
   *   .from(users)
   *   .crossJoin(pets)
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .crossJoin(pets)
   * ```
   */
  crossJoin = this.createJoin("cross", false);
  /**
   * Executes a `cross join lateral` operation by combining rows from two queries into a new table.
   *
   * A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
   *
   * Calling this method retrieves all rows from both main and joined queries, merging all rows from each query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#cross-join-lateral}
   *
   * @param table the query to join.
   */
  crossJoinLateral = this.createJoin("cross", true);
  createSetOperator(type, isAll) {
    return (rightSelection) => {
      const rightSelect = typeof rightSelection === "function" ? rightSelection(getPgSetOperators()) : rightSelection;
      if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
      this.config.setOperators.push({ type, isAll, rightSelect });
      return this;
    };
  }
  /**
   * Adds `union` set operator to the query.
   *
   * Calling this method will combine the result sets of the `select` statements and remove any duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union}
   *
   * @example
   *
   * ```ts
   * // Select all unique names from customers and users tables
   * await db.select({ name: users.name })
   *   .from(users)
   *   .union(
   *     db.select({ name: customers.name }).from(customers)
   *   );
   * // or
   * import { union } from 'drizzle-orm/pg-core'
   *
   * await union(
   *   db.select({ name: users.name }).from(users),
   *   db.select({ name: customers.name }).from(customers)
   * );
   * ```
   */
  union = this.createSetOperator("union", false);
  /**
   * Adds `union all` set operator to the query.
   *
   * Calling this method will combine the result-set of the `select` statements and keep all duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union-all}
   *
   * @example
   *
   * ```ts
   * // Select all transaction ids from both online and in-store sales
   * await db.select({ transaction: onlineSales.transactionId })
   *   .from(onlineSales)
   *   .unionAll(
   *     db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   *   );
   * // or
   * import { unionAll } from 'drizzle-orm/pg-core'
   *
   * await unionAll(
   *   db.select({ transaction: onlineSales.transactionId }).from(onlineSales),
   *   db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   * );
   * ```
   */
  unionAll = this.createSetOperator("union", true);
  /**
   * Adds `intersect` set operator to the query.
   *
   * Calling this method will retain only the rows that are present in both result sets and eliminate duplicates.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect}
   *
   * @example
   *
   * ```ts
   * // Select course names that are offered in both departments A and B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .intersect(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { intersect } from 'drizzle-orm/pg-core'
   *
   * await intersect(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  intersect = this.createSetOperator("intersect", false);
  /**
   * Adds `intersect all` set operator to the query.
   *
   * Calling this method will retain only the rows that are present in both result sets including all duplicates.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect-all}
   *
   * @example
   *
   * ```ts
   * // Select all products and quantities that are ordered by both regular and VIP customers
   * await db.select({
   *   productId: regularCustomerOrders.productId,
   *   quantityOrdered: regularCustomerOrders.quantityOrdered
   * })
   * .from(regularCustomerOrders)
   * .intersectAll(
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * // or
   * import { intersectAll } from 'drizzle-orm/pg-core'
   *
   * await intersectAll(
   *   db.select({
   *     productId: regularCustomerOrders.productId,
   *     quantityOrdered: regularCustomerOrders.quantityOrdered
   *   })
   *   .from(regularCustomerOrders),
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * ```
   */
  intersectAll = this.createSetOperator("intersect", true);
  /**
   * Adds `except` set operator to the query.
   *
   * Calling this method will retrieve all unique rows from the left query, except for the rows that are present in the result set of the right query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#except}
   *
   * @example
   *
   * ```ts
   * // Select all courses offered in department A but not in department B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .except(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { except } from 'drizzle-orm/pg-core'
   *
   * await except(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  except = this.createSetOperator("except", false);
  /**
   * Adds `except all` set operator to the query.
   *
   * Calling this method will retrieve all rows from the left query, except for the rows that are present in the result set of the right query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#except-all}
   *
   * @example
   *
   * ```ts
   * // Select all products that are ordered by regular customers but not by VIP customers
   * await db.select({
   *   productId: regularCustomerOrders.productId,
   *   quantityOrdered: regularCustomerOrders.quantityOrdered,
   * })
   * .from(regularCustomerOrders)
   * .exceptAll(
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered,
   *   })
   *   .from(vipCustomerOrders)
   * );
   * // or
   * import { exceptAll } from 'drizzle-orm/pg-core'
   *
   * await exceptAll(
   *   db.select({
   *     productId: regularCustomerOrders.productId,
   *     quantityOrdered: regularCustomerOrders.quantityOrdered
   *   })
   *   .from(regularCustomerOrders),
   *   db.select({
   *     productId: vipCustomerOrders.productId,
   *     quantityOrdered: vipCustomerOrders.quantityOrdered
   *   })
   *   .from(vipCustomerOrders)
   * );
   * ```
   */
  exceptAll = this.createSetOperator("except", true);
  /** @internal */
  addSetOperators(setOperators) {
    this.config.setOperators.push(...setOperators);
    return this;
  }
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#filtering}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be selected.
   *
   * ```ts
   * // Select all cars with green color
   * await db.select().from(cars).where(eq(cars.color, 'green'));
   * // or
   * await db.select().from(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Select all BMW cars with a green color
   * await db.select().from(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Select all cars with the green or blue color
   * await db.select().from(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    if (typeof where === "function") {
      where = where(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.where = where;
    return this;
  }
  /**
   * Adds a `having` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition. It is typically used with aggregate functions to filter the aggregated data based on a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#aggregations}
   *
   * @param having the `having` clause.
   *
   * @example
   *
   * ```ts
   * // Select all brands with more than one car
   * await db.select({
   * 	brand: cars.brand,
   * 	count: sql<number>`cast(count(${cars.id}) as int)`,
   * })
   *   .from(cars)
   *   .groupBy(cars.brand)
   *   .having(({ count }) => gt(count, 1));
   * ```
   */
  having(having) {
    if (typeof having === "function") {
      having = having(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.having = having;
    return this;
  }
  groupBy(...columns) {
    if (typeof columns[0] === "function") {
      const groupBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
    } else {
      this.config.groupBy = columns;
    }
    return this;
  }
  orderBy(...columns) {
    if (typeof columns[0] === "function") {
      const orderBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    } else {
      const orderByArray = columns;
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    }
    return this;
  }
  /**
   * Adds a `limit` clause to the query.
   *
   * Calling this method will set the maximum number of rows that will be returned by this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param limit the `limit` clause.
   *
   * @example
   *
   * ```ts
   * // Get the first 10 people from this query.
   * await db.select().from(people).limit(10);
   * ```
   */
  limit(limit) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).limit = limit;
    } else {
      this.config.limit = limit;
    }
    return this;
  }
  /**
   * Adds an `offset` clause to the query.
   *
   * Calling this method will skip a number of rows when returning results from this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param offset the `offset` clause.
   *
   * @example
   *
   * ```ts
   * // Get the 10th-20th people from this query.
   * await db.select().from(people).offset(10).limit(10);
   * ```
   */
  offset(offset) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).offset = offset;
    } else {
      this.config.offset = offset;
    }
    return this;
  }
  /**
   * Adds a `for` clause to the query.
   *
   * Calling this method will specify a lock strength for this query that controls how strictly it acquires exclusive access to the rows being queried.
   *
   * See docs: {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE}
   *
   * @param strength the lock strength.
   * @param config the lock configuration.
   */
  for(strength, config = {}) {
    this.config.lockingClause = { strength, config };
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildSelectQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  as(alias) {
    const usedTables = [];
    usedTables.push(...extractUsedTable(this.config.table));
    if (this.config.joins) {
      for (const it of this.config.joins) usedTables.push(...extractUsedTable(it.table));
    }
    return new Proxy(
      new Subquery(this.getSQL(), this.config.fields, alias, false, [...new Set(usedTables)]),
      new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  /** @internal */
  getSelectedFields() {
    return new Proxy(
      this.config.fields,
      new SelectionProxyHandler({ alias: this.tableName, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  $dynamic() {
    return this;
  }
  $withCache(config) {
    this.cacheConfig = config === void 0 ? { config: {}, enable: true, autoInvalidate: true } : config === false ? { enable: false } : { enable: true, autoInvalidate: true, ...config };
    return this;
  }
};
var PgSelectBase = class extends PgSelectQueryBuilderBase {
  static [entityKind] = "PgSelect";
  /** @internal */
  _prepare(name) {
    const { session, config, dialect, joinsNotNullableMap, authToken, cacheConfig, usedTables } = this;
    if (!session) {
      throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
    }
    const { fields } = config;
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      const fieldsList = orderSelectedFields(fields);
      const query = session.prepareQuery(dialect.sqlToQuery(this.getSQL()), fieldsList, name, true, void 0, {
        type: "select",
        tables: [...usedTables]
      }, cacheConfig);
      query.joinsNotNullableMap = joinsNotNullableMap;
      return query.setToken(authToken);
    });
  }
  /**
   * Create a prepared statement for this query. This allows
   * the database to remember this query for the given session
   * and call it by name, rather than specifying the full query.
   *
   * {@link https://www.postgresql.org/docs/current/sql-prepare.html | Postgres prepare documentation}
   */
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
};
applyMixins(PgSelectBase, [QueryPromise]);
function createSetOperator(type, isAll) {
  return (leftSelect, rightSelect, ...restSelects) => {
    const setOperators = [rightSelect, ...restSelects].map((select) => ({
      type,
      isAll,
      rightSelect: select
    }));
    for (const setOperator of setOperators) {
      if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
    }
    return leftSelect.addSetOperators(setOperators);
  };
}
var getPgSetOperators = () => ({
  union,
  unionAll,
  intersect,
  intersectAll,
  except,
  exceptAll
});
var union = createSetOperator("union", false);
var unionAll = createSetOperator("union", true);
var intersect = createSetOperator("intersect", false);
var intersectAll = createSetOperator("intersect", true);
var except = createSetOperator("except", false);
var exceptAll = createSetOperator("except", true);

// node_modules/drizzle-orm/pg-core/query-builders/query-builder.js
var QueryBuilder = class {
  static [entityKind] = "PgQueryBuilder";
  dialect;
  dialectConfig;
  constructor(dialect) {
    this.dialect = is(dialect, PgDialect) ? dialect : void 0;
    this.dialectConfig = is(dialect, PgDialect) ? void 0 : dialect;
  }
  $with = (alias, selection) => {
    const queryBuilder = this;
    const as = (qb) => {
      if (typeof qb === "function") {
        qb = qb(queryBuilder);
      }
      return new Proxy(
        new WithSubquery(
          qb.getSQL(),
          selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
          alias,
          true
        ),
        new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
      );
    };
    return { as };
  };
  with(...queries) {
    const self = this;
    function select(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        withList: queries
      });
    }
    function selectDistinct(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        distinct: true
      });
    }
    function selectDistinctOn(on, fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        distinct: { on }
      });
    }
    return { select, selectDistinct, selectDistinctOn };
  }
  select(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect()
    });
  }
  selectDistinct(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: true
    });
  }
  selectDistinctOn(on, fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: { on }
    });
  }
  // Lazy load dialect to avoid circular dependency
  getDialect() {
    if (!this.dialect) {
      this.dialect = new PgDialect(this.dialectConfig);
    }
    return this.dialect;
  }
};

// node_modules/drizzle-orm/pg-core/utils.js
function extractUsedTable(table) {
  if (is(table, PgTable)) {
    return [table[Schema] ? `${table[Schema]}.${table[Table.Symbol.BaseName]}` : table[Table.Symbol.BaseName]];
  }
  if (is(table, Subquery)) {
    return table._.usedTables ?? [];
  }
  if (is(table, SQL)) {
    return table.usedTables ?? [];
  }
  return [];
}

// node_modules/drizzle-orm/pg-core/query-builders/delete.js
var PgDeleteBase = class extends QueryPromise {
  constructor(table, session, dialect, withList) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { table, withList };
  }
  static [entityKind] = "PgDelete";
  config;
  cacheConfig;
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will delete only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be deleted.
   *
   * ```ts
   * // Delete all cars with green color
   * await db.delete(cars).where(eq(cars.color, 'green'));
   * // or
   * await db.delete(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Delete all BMW cars with a green color
   * await db.delete(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Delete all cars with the green or blue color
   * await db.delete(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  returning(fields = this.config.table[Table.Symbol.Columns]) {
    this.config.returningFields = fields;
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildDeleteQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
        type: "delete",
        tables: extractUsedTable(this.config.table)
      }, this.cacheConfig);
    });
  }
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
  /** @internal */
  getSelectedFields() {
    return this.config.returningFields ? new Proxy(
      this.config.returningFields,
      new SelectionProxyHandler({
        alias: getTableName(this.config.table),
        sqlAliasedBehavior: "alias",
        sqlBehavior: "error"
      })
    ) : void 0;
  }
  $dynamic() {
    return this;
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/insert.js
var PgInsertBuilder = class {
  constructor(table, session, dialect, withList, overridingSystemValue_) {
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.withList = withList;
    this.overridingSystemValue_ = overridingSystemValue_;
  }
  static [entityKind] = "PgInsertBuilder";
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  overridingSystemValue() {
    this.overridingSystemValue_ = true;
    return this;
  }
  values(values) {
    values = Array.isArray(values) ? values : [values];
    if (values.length === 0) {
      throw new Error("values() must be called with at least one value");
    }
    const mappedValues = values.map((entry) => {
      const result = {};
      const cols = this.table[Table.Symbol.Columns];
      for (const colKey of Object.keys(entry)) {
        const colValue = entry[colKey];
        result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
      }
      return result;
    });
    return new PgInsertBase(
      this.table,
      mappedValues,
      this.session,
      this.dialect,
      this.withList,
      false,
      this.overridingSystemValue_
    ).setToken(this.authToken);
  }
  select(selectQuery) {
    const select = typeof selectQuery === "function" ? selectQuery(new QueryBuilder()) : selectQuery;
    if (!is(select, SQL) && !haveSameKeys(this.table[Columns], select._.selectedFields)) {
      throw new Error(
        "Insert select error: selected fields are not the same or are in a different order compared to the table definition"
      );
    }
    return new PgInsertBase(this.table, select, this.session, this.dialect, this.withList, true);
  }
};
var PgInsertBase = class extends QueryPromise {
  constructor(table, values, session, dialect, withList, select, overridingSystemValue_) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { table, values, withList, select, overridingSystemValue_ };
  }
  static [entityKind] = "PgInsert";
  config;
  cacheConfig;
  returning(fields = this.config.table[Table.Symbol.Columns]) {
    this.config.returningFields = fields;
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /**
   * Adds an `on conflict do nothing` clause to the query.
   *
   * Calling this method simply avoids inserting a row as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#on-conflict-do-nothing}
   *
   * @param config The `target` and `where` clauses.
   *
   * @example
   * ```ts
   * // Insert one row and cancel the insert if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing();
   *
   * // Explicitly specify conflict target
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing({ target: cars.id });
   * ```
   */
  onConflictDoNothing(config = {}) {
    if (config.target === void 0) {
      this.config.onConflict = sql`do nothing`;
    } else {
      let targetColumn = "";
      targetColumn = Array.isArray(config.target) ? config.target.map((it) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(it))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));
      const whereSql = config.where ? sql` where ${config.where}` : void 0;
      this.config.onConflict = sql`(${sql.raw(targetColumn)})${whereSql} do nothing`;
    }
    return this;
  }
  /**
   * Adds an `on conflict do update` clause to the query.
   *
   * Calling this method will update the existing row that conflicts with the row proposed for insertion as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#upserts-and-conflicts}
   *
   * @param config The `target`, `set` and `where` clauses.
   *
   * @example
   * ```ts
   * // Update the row if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'Porsche' }
   *   });
   *
   * // Upsert with 'where' clause
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'newBMW' },
   *     targetWhere: sql`${cars.createdAt} > '2023-01-01'::date`,
   *   });
   * ```
   */
  onConflictDoUpdate(config) {
    if (config.where && (config.targetWhere || config.setWhere)) {
      throw new Error(
        'You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.'
      );
    }
    const whereSql = config.where ? sql` where ${config.where}` : void 0;
    const targetWhereSql = config.targetWhere ? sql` where ${config.targetWhere}` : void 0;
    const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : void 0;
    const setSql = this.dialect.buildUpdateSet(this.config.table, mapUpdateSet(this.config.table, config.set));
    let targetColumn = "";
    targetColumn = Array.isArray(config.target) ? config.target.map((it) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(it))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));
    this.config.onConflict = sql`(${sql.raw(targetColumn)})${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`;
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildInsertQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
        type: "insert",
        tables: extractUsedTable(this.config.table)
      }, this.cacheConfig);
    });
  }
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
  /** @internal */
  getSelectedFields() {
    return this.config.returningFields ? new Proxy(
      this.config.returningFields,
      new SelectionProxyHandler({
        alias: getTableName(this.config.table),
        sqlAliasedBehavior: "alias",
        sqlBehavior: "error"
      })
    ) : void 0;
  }
  $dynamic() {
    return this;
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/refresh-materialized-view.js
var PgRefreshMaterializedView = class extends QueryPromise {
  constructor(view, session, dialect) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { view };
  }
  static [entityKind] = "PgRefreshMaterializedView";
  config;
  concurrently() {
    if (this.config.withNoData !== void 0) {
      throw new Error("Cannot use concurrently and withNoData together");
    }
    this.config.concurrently = true;
    return this;
  }
  withNoData() {
    if (this.config.concurrently !== void 0) {
      throw new Error("Cannot use concurrently and withNoData together");
    }
    this.config.withNoData = true;
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildRefreshMaterializedViewQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), void 0, name, true);
    });
  }
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(placeholderValues, this.authToken);
    });
  };
};

// node_modules/drizzle-orm/pg-core/query-builders/update.js
var PgUpdateBuilder = class {
  constructor(table, session, dialect, withList) {
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.withList = withList;
  }
  static [entityKind] = "PgUpdateBuilder";
  authToken;
  setToken(token) {
    this.authToken = token;
    return this;
  }
  set(values) {
    return new PgUpdateBase(
      this.table,
      mapUpdateSet(this.table, values),
      this.session,
      this.dialect,
      this.withList
    ).setToken(this.authToken);
  }
};
var PgUpdateBase = class extends QueryPromise {
  constructor(table, set, session, dialect, withList) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { set, table, withList, joins: [] };
    this.tableName = getTableLikeName(table);
    this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
  }
  static [entityKind] = "PgUpdate";
  config;
  tableName;
  joinsNotNullableMap;
  cacheConfig;
  from(source) {
    const src = source;
    const tableName = getTableLikeName(src);
    if (typeof tableName === "string") {
      this.joinsNotNullableMap[tableName] = true;
    }
    this.config.from = src;
    return this;
  }
  getTableLikeFields(table) {
    if (is(table, PgTable)) {
      return table[Table.Symbol.Columns];
    } else if (is(table, Subquery)) {
      return table._.selectedFields;
    }
    return table[ViewBaseConfig].selectedFields;
  }
  createJoin(joinType) {
    return (table, on) => {
      const tableName = getTableLikeName(table);
      if (typeof tableName === "string" && this.config.joins.some((join) => join.alias === tableName)) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (typeof on === "function") {
        const from = this.config.from && !is(this.config.from, SQL) ? this.getTableLikeFields(this.config.from) : void 0;
        on = on(
          new Proxy(
            this.config.table[Table.Symbol.Columns],
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          ),
          from && new Proxy(
            from,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      this.config.joins.push({ on, table, joinType, alias: tableName });
      if (typeof tableName === "string") {
        switch (joinType) {
          case "left": {
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
          case "right": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "inner": {
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "full": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
        }
      }
      return this;
    };
  }
  leftJoin = this.createJoin("left");
  rightJoin = this.createJoin("right");
  innerJoin = this.createJoin("inner");
  fullJoin = this.createJoin("full");
  /**
   * Adds a 'where' clause to the query.
   *
   * Calling this method will update only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param where the 'where' clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be updated.
   *
   * ```ts
   * // Update all cars with green color
   * await db.update(cars).set({ color: 'red' })
   *   .where(eq(cars.color, 'green'));
   * // or
   * await db.update(cars).set({ color: 'red' })
   *   .where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Update all BMW cars with a green color
   * await db.update(cars).set({ color: 'red' })
   *   .where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Update all cars with the green or blue color
   * await db.update(cars).set({ color: 'red' })
   *   .where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  returning(fields) {
    if (!fields) {
      fields = Object.assign({}, this.config.table[Table.Symbol.Columns]);
      if (this.config.from) {
        const tableName = getTableLikeName(this.config.from);
        if (typeof tableName === "string" && this.config.from && !is(this.config.from, SQL)) {
          const fromFields = this.getTableLikeFields(this.config.from);
          fields[tableName] = fromFields;
        }
        for (const join of this.config.joins) {
          const tableName2 = getTableLikeName(join.table);
          if (typeof tableName2 === "string" && !is(join.table, SQL)) {
            const fromFields = this.getTableLikeFields(join.table);
            fields[tableName2] = fromFields;
          }
        }
      }
    }
    this.config.returningFields = fields;
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildUpdateQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(name) {
    const query = this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
      type: "insert",
      tables: extractUsedTable(this.config.table)
    }, this.cacheConfig);
    query.joinsNotNullableMap = this.joinsNotNullableMap;
    return query;
  }
  prepare(name) {
    return this._prepare(name);
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute = (placeholderValues) => {
    return this._prepare().execute(placeholderValues, this.authToken);
  };
  /** @internal */
  getSelectedFields() {
    return this.config.returningFields ? new Proxy(
      this.config.returningFields,
      new SelectionProxyHandler({
        alias: getTableName(this.config.table),
        sqlAliasedBehavior: "alias",
        sqlBehavior: "error"
      })
    ) : void 0;
  }
  $dynamic() {
    return this;
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/count.js
var PgCountBuilder = class _PgCountBuilder extends SQL {
  constructor(params) {
    super(_PgCountBuilder.buildEmbeddedCount(params.source, params.filters).queryChunks);
    this.params = params;
    this.mapWith(Number);
    this.session = params.session;
    this.sql = _PgCountBuilder.buildCount(
      params.source,
      params.filters
    );
  }
  sql;
  token;
  static [entityKind] = "PgCountBuilder";
  [Symbol.toStringTag] = "PgCountBuilder";
  session;
  static buildEmbeddedCount(source, filters) {
    return sql`(select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters})`;
  }
  static buildCount(source, filters) {
    return sql`select count(*) as count from ${source}${sql.raw(" where ").if(filters)}${filters};`;
  }
  /** @intrnal */
  setToken(token) {
    this.token = token;
    return this;
  }
  then(onfulfilled, onrejected) {
    return Promise.resolve(this.session.count(this.sql, this.token)).then(
      onfulfilled,
      onrejected
    );
  }
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally?.();
        return value;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      }
    );
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/query.js
var RelationalQueryBuilder = class {
  constructor(fullSchema, schema2, tableNamesMap, table, tableConfig, dialect, session) {
    this.fullSchema = fullSchema;
    this.schema = schema2;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session;
  }
  static [entityKind] = "PgRelationalQueryBuilder";
  findMany(config) {
    return new PgRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? config : {},
      "many"
    );
  }
  findFirst(config) {
    return new PgRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? { ...config, limit: 1 } : { limit: 1 },
      "first"
    );
  }
};
var PgRelationalQuery = class extends QueryPromise {
  constructor(fullSchema, schema2, tableNamesMap, table, tableConfig, dialect, session, config, mode) {
    super();
    this.fullSchema = fullSchema;
    this.schema = schema2;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session;
    this.config = config;
    this.mode = mode;
  }
  static [entityKind] = "PgRelationalQuery";
  /** @internal */
  _prepare(name) {
    return tracer.startActiveSpan("drizzle.prepareQuery", () => {
      const { query, builtQuery } = this._toSQL();
      return this.session.prepareQuery(
        builtQuery,
        void 0,
        name,
        true,
        (rawRows, mapColumnValue) => {
          const rows = rawRows.map(
            (row) => mapRelationalRow(this.schema, this.tableConfig, row, query.selection, mapColumnValue)
          );
          if (this.mode === "first") {
            return rows[0];
          }
          return rows;
        }
      );
    });
  }
  prepare(name) {
    return this._prepare(name);
  }
  _getQuery() {
    return this.dialect.buildRelationalQueryWithoutPK({
      fullSchema: this.fullSchema,
      schema: this.schema,
      tableNamesMap: this.tableNamesMap,
      table: this.table,
      tableConfig: this.tableConfig,
      queryConfig: this.config,
      tableAlias: this.tableConfig.tsName
    });
  }
  /** @internal */
  getSQL() {
    return this._getQuery().sql;
  }
  _toSQL() {
    const query = this._getQuery();
    const builtQuery = this.dialect.sqlToQuery(query.sql);
    return { query, builtQuery };
  }
  toSQL() {
    return this._toSQL().builtQuery;
  }
  authToken;
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  execute() {
    return tracer.startActiveSpan("drizzle.operation", () => {
      return this._prepare().execute(void 0, this.authToken);
    });
  }
};

// node_modules/drizzle-orm/pg-core/query-builders/raw.js
var PgRaw = class extends QueryPromise {
  constructor(execute, sql2, query, mapBatchResult) {
    super();
    this.execute = execute;
    this.sql = sql2;
    this.query = query;
    this.mapBatchResult = mapBatchResult;
  }
  static [entityKind] = "PgRaw";
  /** @internal */
  getSQL() {
    return this.sql;
  }
  getQuery() {
    return this.query;
  }
  mapResult(result, isFromBatch) {
    return isFromBatch ? this.mapBatchResult(result) : result;
  }
  _prepare() {
    return this;
  }
  /** @internal */
  isResponseInArrayMode() {
    return false;
  }
};

// node_modules/drizzle-orm/pg-core/db.js
var PgDatabase = class {
  constructor(dialect, session, schema2) {
    this.dialect = dialect;
    this.session = session;
    this._ = schema2 ? {
      schema: schema2.schema,
      fullSchema: schema2.fullSchema,
      tableNamesMap: schema2.tableNamesMap,
      session
    } : {
      schema: void 0,
      fullSchema: {},
      tableNamesMap: {},
      session
    };
    this.query = {};
    if (this._.schema) {
      for (const [tableName, columns] of Object.entries(this._.schema)) {
        this.query[tableName] = new RelationalQueryBuilder(
          schema2.fullSchema,
          this._.schema,
          this._.tableNamesMap,
          schema2.fullSchema[tableName],
          columns,
          dialect,
          session
        );
      }
    }
    this.$cache = { invalidate: async (_params) => {
    } };
  }
  static [entityKind] = "PgDatabase";
  query;
  /**
   * Creates a subquery that defines a temporary named result set as a CTE.
   *
   * It is useful for breaking down complex queries into simpler parts and for reusing the result set in subsequent parts of the query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param alias The alias for the subquery.
   *
   * Failure to provide an alias will result in a DrizzleTypeError, preventing the subquery from being referenced in other queries.
   *
   * @example
   *
   * ```ts
   * // Create a subquery with alias 'sq' and use it in the select query
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * const result = await db.with(sq).select().from(sq);
   * ```
   *
   * To select arbitrary SQL values as fields in a CTE and reference them in other CTEs or in the main query, you need to add aliases to them:
   *
   * ```ts
   * // Select an arbitrary SQL value as a field in a CTE and reference it in the main query
   * const sq = db.$with('sq').as(db.select({
   *   name: sql<string>`upper(${users.name})`.as('name'),
   * })
   * .from(users));
   *
   * const result = await db.with(sq).select({ name: sq.name }).from(sq);
   * ```
   */
  $with = (alias, selection) => {
    const self = this;
    const as = (qb) => {
      if (typeof qb === "function") {
        qb = qb(new QueryBuilder(self.dialect));
      }
      return new Proxy(
        new WithSubquery(
          qb.getSQL(),
          selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
          alias,
          true
        ),
        new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
      );
    };
    return { as };
  };
  $count(source, filters) {
    return new PgCountBuilder({ source, filters, session: this.session });
  }
  $cache;
  /**
   * Incorporates a previously defined CTE (using `$with`) into the main query.
   *
   * This method allows the main query to reference a temporary named result set.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param queries The CTEs to incorporate into the main query.
   *
   * @example
   *
   * ```ts
   * // Define a subquery 'sq' as a CTE using $with
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * // Incorporate the CTE 'sq' into the main query and select from it
   * const result = await db.with(sq).select().from(sq);
   * ```
   */
  with(...queries) {
    const self = this;
    function select(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries
      });
    }
    function selectDistinct(fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries,
        distinct: true
      });
    }
    function selectDistinctOn(on, fields) {
      return new PgSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries,
        distinct: { on }
      });
    }
    function update(table) {
      return new PgUpdateBuilder(table, self.session, self.dialect, queries);
    }
    function insert(table) {
      return new PgInsertBuilder(table, self.session, self.dialect, queries);
    }
    function delete_(table) {
      return new PgDeleteBase(table, self.session, self.dialect, queries);
    }
    return { select, selectDistinct, selectDistinctOn, update, insert, delete: delete_ };
  }
  select(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect
    });
  }
  selectDistinct(fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect,
      distinct: true
    });
  }
  selectDistinctOn(on, fields) {
    return new PgSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect,
      distinct: { on }
    });
  }
  /**
   * Creates an update query.
   *
   * Calling this method without `.where()` clause will update all rows in a table. The `.where()` clause specifies which rows should be updated.
   *
   * Use `.set()` method to specify which values to update.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param table The table to update.
   *
   * @example
   *
   * ```ts
   * // Update all rows in the 'cars' table
   * await db.update(cars).set({ color: 'red' });
   *
   * // Update rows with filters and conditions
   * await db.update(cars).set({ color: 'red' }).where(eq(cars.brand, 'BMW'));
   *
   * // Update with returning clause
   * const updatedCar: Car[] = await db.update(cars)
   *   .set({ color: 'red' })
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  update(table) {
    return new PgUpdateBuilder(table, this.session, this.dialect);
  }
  /**
   * Creates an insert query.
   *
   * Calling this method will create new rows in a table. Use `.values()` method to specify which values to insert.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert}
   *
   * @param table The table to insert into.
   *
   * @example
   *
   * ```ts
   * // Insert one row
   * await db.insert(cars).values({ brand: 'BMW' });
   *
   * // Insert multiple rows
   * await db.insert(cars).values([{ brand: 'BMW' }, { brand: 'Porsche' }]);
   *
   * // Insert with returning clause
   * const insertedCar: Car[] = await db.insert(cars)
   *   .values({ brand: 'BMW' })
   *   .returning();
   * ```
   */
  insert(table) {
    return new PgInsertBuilder(table, this.session, this.dialect);
  }
  /**
   * Creates a delete query.
   *
   * Calling this method without `.where()` clause will delete all rows in a table. The `.where()` clause specifies which rows should be deleted.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param table The table to delete from.
   *
   * @example
   *
   * ```ts
   * // Delete all rows in the 'cars' table
   * await db.delete(cars);
   *
   * // Delete rows with filters and conditions
   * await db.delete(cars).where(eq(cars.color, 'green'));
   *
   * // Delete with returning clause
   * const deletedCar: Car[] = await db.delete(cars)
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  delete(table) {
    return new PgDeleteBase(table, this.session, this.dialect);
  }
  refreshMaterializedView(view) {
    return new PgRefreshMaterializedView(view, this.session, this.dialect);
  }
  authToken;
  execute(query) {
    const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
    const builtQuery = this.dialect.sqlToQuery(sequel);
    const prepared = this.session.prepareQuery(
      builtQuery,
      void 0,
      void 0,
      false
    );
    return new PgRaw(
      () => prepared.execute(void 0, this.authToken),
      sequel,
      builtQuery,
      (result) => prepared.mapResult(result, true)
    );
  }
  transaction(transaction, config) {
    return this.session.transaction(transaction, config);
  }
};

// node_modules/drizzle-orm/node-postgres/session.js
import pg from "pg";

// node_modules/drizzle-orm/cache/core/cache.js
var Cache = class {
  static [entityKind] = "Cache";
};
var NoopCache = class extends Cache {
  strategy() {
    return "all";
  }
  static [entityKind] = "NoopCache";
  async get(_key) {
    return void 0;
  }
  async put(_hashedQuery, _response, _tables, _config) {
  }
  async onMutate(_params) {
  }
};
async function hashQuery(sql2, params) {
  const dataToHash = `${sql2}-${JSON.stringify(params)}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(dataToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = [...new Uint8Array(hashBuffer)];
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

// node_modules/drizzle-orm/pg-core/session.js
var PgPreparedQuery = class {
  constructor(query, cache, queryMetadata, cacheConfig) {
    this.query = query;
    this.cache = cache;
    this.queryMetadata = queryMetadata;
    this.cacheConfig = cacheConfig;
    if (cache && cache.strategy() === "all" && cacheConfig === void 0) {
      this.cacheConfig = { enable: true, autoInvalidate: true };
    }
    if (!this.cacheConfig?.enable) {
      this.cacheConfig = void 0;
    }
  }
  authToken;
  getQuery() {
    return this.query;
  }
  mapResult(response, _isFromBatch) {
    return response;
  }
  /** @internal */
  setToken(token) {
    this.authToken = token;
    return this;
  }
  static [entityKind] = "PgPreparedQuery";
  /** @internal */
  joinsNotNullableMap;
  /** @internal */
  async queryWithCache(queryString, params, query) {
    if (this.cache === void 0 || is(this.cache, NoopCache) || this.queryMetadata === void 0) {
      try {
        return await query();
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if (this.cacheConfig && !this.cacheConfig.enable) {
      try {
        return await query();
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if ((this.queryMetadata.type === "insert" || this.queryMetadata.type === "update" || this.queryMetadata.type === "delete") && this.queryMetadata.tables.length > 0) {
      try {
        const [res] = await Promise.all([
          query(),
          this.cache.onMutate({ tables: this.queryMetadata.tables })
        ]);
        return res;
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if (!this.cacheConfig) {
      try {
        return await query();
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if (this.queryMetadata.type === "select") {
      const fromCache = await this.cache.get(
        this.cacheConfig.tag ?? await hashQuery(queryString, params),
        this.queryMetadata.tables,
        this.cacheConfig.tag !== void 0,
        this.cacheConfig.autoInvalidate
      );
      if (fromCache === void 0) {
        let result;
        try {
          result = await query();
        } catch (e) {
          throw new DrizzleQueryError(queryString, params, e);
        }
        await this.cache.put(
          this.cacheConfig.tag ?? await hashQuery(queryString, params),
          result,
          // make sure we send tables that were used in a query only if user wants to invalidate it on each write
          this.cacheConfig.autoInvalidate ? this.queryMetadata.tables : [],
          this.cacheConfig.tag !== void 0,
          this.cacheConfig.config
        );
        return result;
      }
      return fromCache;
    }
    try {
      return await query();
    } catch (e) {
      throw new DrizzleQueryError(queryString, params, e);
    }
  }
};
var PgSession = class {
  constructor(dialect) {
    this.dialect = dialect;
  }
  static [entityKind] = "PgSession";
  /** @internal */
  execute(query, token) {
    return tracer.startActiveSpan("drizzle.operation", () => {
      const prepared = tracer.startActiveSpan("drizzle.prepareQuery", () => {
        return this.prepareQuery(
          this.dialect.sqlToQuery(query),
          void 0,
          void 0,
          false
        );
      });
      return prepared.setToken(token).execute(void 0, token);
    });
  }
  all(query) {
    return this.prepareQuery(
      this.dialect.sqlToQuery(query),
      void 0,
      void 0,
      false
    ).all();
  }
  /** @internal */
  async count(sql2, token) {
    const res = await this.execute(sql2, token);
    return Number(
      res[0]["count"]
    );
  }
};
var PgTransaction = class extends PgDatabase {
  constructor(dialect, session, schema2, nestedIndex = 0) {
    super(dialect, session, schema2);
    this.schema = schema2;
    this.nestedIndex = nestedIndex;
  }
  static [entityKind] = "PgTransaction";
  rollback() {
    throw new TransactionRollbackError();
  }
  /** @internal */
  getTransactionConfigSQL(config) {
    const chunks = [];
    if (config.isolationLevel) {
      chunks.push(`isolation level ${config.isolationLevel}`);
    }
    if (config.accessMode) {
      chunks.push(config.accessMode);
    }
    if (typeof config.deferrable === "boolean") {
      chunks.push(config.deferrable ? "deferrable" : "not deferrable");
    }
    return sql.raw(chunks.join(" "));
  }
  setTransaction(config) {
    return this.session.execute(sql`set transaction ${this.getTransactionConfigSQL(config)}`);
  }
};

// node_modules/drizzle-orm/node-postgres/session.js
var { Pool, types } = pg;
var NodePgPreparedQuery = class extends PgPreparedQuery {
  constructor(client, queryString, params, logger, cache, queryMetadata, cacheConfig, fields, name, _isResponseInArrayMode, customResultMapper) {
    super({ sql: queryString, params }, cache, queryMetadata, cacheConfig);
    this.client = client;
    this.queryString = queryString;
    this.params = params;
    this.logger = logger;
    this.fields = fields;
    this._isResponseInArrayMode = _isResponseInArrayMode;
    this.customResultMapper = customResultMapper;
    this.rawQueryConfig = {
      name,
      text: queryString,
      types: {
        // @ts-ignore
        getTypeParser: (typeId, format) => {
          if (typeId === types.builtins.TIMESTAMPTZ) {
            return (val) => val;
          }
          if (typeId === types.builtins.TIMESTAMP) {
            return (val) => val;
          }
          if (typeId === types.builtins.DATE) {
            return (val) => val;
          }
          if (typeId === types.builtins.INTERVAL) {
            return (val) => val;
          }
          if (typeId === 1231) {
            return (val) => val;
          }
          if (typeId === 1115) {
            return (val) => val;
          }
          if (typeId === 1185) {
            return (val) => val;
          }
          if (typeId === 1187) {
            return (val) => val;
          }
          if (typeId === 1182) {
            return (val) => val;
          }
          return types.getTypeParser(typeId, format);
        }
      }
    };
    this.queryConfig = {
      name,
      text: queryString,
      rowMode: "array",
      types: {
        // @ts-ignore
        getTypeParser: (typeId, format) => {
          if (typeId === types.builtins.TIMESTAMPTZ) {
            return (val) => val;
          }
          if (typeId === types.builtins.TIMESTAMP) {
            return (val) => val;
          }
          if (typeId === types.builtins.DATE) {
            return (val) => val;
          }
          if (typeId === types.builtins.INTERVAL) {
            return (val) => val;
          }
          if (typeId === 1231) {
            return (val) => val;
          }
          if (typeId === 1115) {
            return (val) => val;
          }
          if (typeId === 1185) {
            return (val) => val;
          }
          if (typeId === 1187) {
            return (val) => val;
          }
          if (typeId === 1182) {
            return (val) => val;
          }
          return types.getTypeParser(typeId, format);
        }
      }
    };
  }
  static [entityKind] = "NodePgPreparedQuery";
  rawQueryConfig;
  queryConfig;
  async execute(placeholderValues = {}) {
    return tracer.startActiveSpan("drizzle.execute", async () => {
      const params = fillPlaceholders(this.params, placeholderValues);
      this.logger.logQuery(this.rawQueryConfig.text, params);
      const { fields, rawQueryConfig: rawQuery, client, queryConfig: query, joinsNotNullableMap, customResultMapper } = this;
      if (!fields && !customResultMapper) {
        return tracer.startActiveSpan("drizzle.driver.execute", async (span) => {
          span?.setAttributes({
            "drizzle.query.name": rawQuery.name,
            "drizzle.query.text": rawQuery.text,
            "drizzle.query.params": JSON.stringify(params)
          });
          return this.queryWithCache(rawQuery.text, params, async () => {
            return await client.query(rawQuery, params);
          });
        });
      }
      const result = await tracer.startActiveSpan("drizzle.driver.execute", (span) => {
        span?.setAttributes({
          "drizzle.query.name": query.name,
          "drizzle.query.text": query.text,
          "drizzle.query.params": JSON.stringify(params)
        });
        return this.queryWithCache(query.text, params, async () => {
          return await client.query(query, params);
        });
      });
      return tracer.startActiveSpan("drizzle.mapResponse", () => {
        return customResultMapper ? customResultMapper(result.rows) : result.rows.map((row) => mapResultRow(fields, row, joinsNotNullableMap));
      });
    });
  }
  all(placeholderValues = {}) {
    return tracer.startActiveSpan("drizzle.execute", () => {
      const params = fillPlaceholders(this.params, placeholderValues);
      this.logger.logQuery(this.rawQueryConfig.text, params);
      return tracer.startActiveSpan("drizzle.driver.execute", (span) => {
        span?.setAttributes({
          "drizzle.query.name": this.rawQueryConfig.name,
          "drizzle.query.text": this.rawQueryConfig.text,
          "drizzle.query.params": JSON.stringify(params)
        });
        return this.queryWithCache(this.rawQueryConfig.text, params, async () => {
          return this.client.query(this.rawQueryConfig, params);
        }).then((result) => result.rows);
      });
    });
  }
  /** @internal */
  isResponseInArrayMode() {
    return this._isResponseInArrayMode;
  }
};
var NodePgSession = class _NodePgSession extends PgSession {
  constructor(client, dialect, schema2, options = {}) {
    super(dialect);
    this.client = client;
    this.schema = schema2;
    this.options = options;
    this.logger = options.logger ?? new NoopLogger();
    this.cache = options.cache ?? new NoopCache();
  }
  static [entityKind] = "NodePgSession";
  logger;
  cache;
  prepareQuery(query, fields, name, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig) {
    return new NodePgPreparedQuery(
      this.client,
      query.sql,
      query.params,
      this.logger,
      this.cache,
      queryMetadata,
      cacheConfig,
      fields,
      name,
      isResponseInArrayMode,
      customResultMapper
    );
  }
  async transaction(transaction, config) {
    const isPool = this.client instanceof Pool || Object.getPrototypeOf(this.client).constructor.name.includes("Pool");
    const session = isPool ? new _NodePgSession(await this.client.connect(), this.dialect, this.schema, this.options) : this;
    const tx = new NodePgTransaction(this.dialect, session, this.schema);
    await tx.execute(sql`begin${config ? sql` ${tx.getTransactionConfigSQL(config)}` : void 0}`);
    try {
      const result = await transaction(tx);
      await tx.execute(sql`commit`);
      return result;
    } catch (error) {
      await tx.execute(sql`rollback`);
      throw error;
    } finally {
      if (isPool) session.client.release();
    }
  }
  async count(sql2) {
    const res = await this.execute(sql2);
    return Number(
      res["rows"][0]["count"]
    );
  }
};
var NodePgTransaction = class _NodePgTransaction extends PgTransaction {
  static [entityKind] = "NodePgTransaction";
  async transaction(transaction) {
    const savepointName = `sp${this.nestedIndex + 1}`;
    const tx = new _NodePgTransaction(
      this.dialect,
      this.session,
      this.schema,
      this.nestedIndex + 1
    );
    await tx.execute(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await tx.execute(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (err) {
      await tx.execute(sql.raw(`rollback to savepoint ${savepointName}`));
      throw err;
    }
  }
};

// node_modules/drizzle-orm/node-postgres/driver.js
var NodePgDriver = class {
  constructor(client, dialect, options = {}) {
    this.client = client;
    this.dialect = dialect;
    this.options = options;
  }
  static [entityKind] = "NodePgDriver";
  createSession(schema2) {
    return new NodePgSession(this.client, this.dialect, schema2, {
      logger: this.options.logger,
      cache: this.options.cache
    });
  }
};
var NodePgDatabase = class extends PgDatabase {
  static [entityKind] = "NodePgDatabase";
};
function construct(client, config = {}) {
  const dialect = new PgDialect({ casing: config.casing });
  let logger;
  if (config.logger === true) {
    logger = new DefaultLogger();
  } else if (config.logger !== false) {
    logger = config.logger;
  }
  let schema2;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers
    );
    schema2 = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap
    };
  }
  const driver = new NodePgDriver(client, dialect, { logger, cache: config.cache });
  const session = driver.createSession(schema2);
  const db = new NodePgDatabase(dialect, session, schema2);
  db.$client = client;
  db.$cache = config.cache;
  if (db.$cache) {
    db.$cache["invalidate"] = config.cache?.onMutate;
  }
  return db;
}
function drizzle(...params) {
  if (typeof params[0] === "string") {
    const instance = new pg2.Pool({
      connectionString: params[0]
    });
    return construct(instance, params[1]);
  }
  if (isConfig(params[0])) {
    const { connection, client, ...drizzleConfig } = params[0];
    if (client) return construct(client, drizzleConfig);
    const instance = typeof connection === "string" ? new pg2.Pool({
      connectionString: connection
    }) : new pg2.Pool(connection);
    return construct(instance, drizzleConfig);
  }
  return construct(params[0], params[1]);
}
((drizzle2) => {
  function mock(config) {
    return construct({}, config);
  }
  drizzle2.mock = mock;
})(drizzle || (drizzle = {}));

// src/db/index.ts
import { Pool as Pool2 } from "pg";

// src/db/schema/_base.ts
var id = () => uuid("id").primaryKey().defaultRandom();
var timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};
var createdAtColumn = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
var updatedAtColumn = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
var softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true })
};

// src/db/schema/users.ts
var users_exports = {};
__export(users_exports, {
  profiles: () => profiles,
  userAddresses: () => userAddresses,
  userRoleEnum: () => userRoleEnum,
  userStatusEnum: () => userStatusEnum,
  users: () => users
});
var userRoleEnum = pgEnum("user_role", [
  "customer",
  "vendor",
  "admin",
  "support"
]);
var userStatusEnum = pgEnum("user_status", [
  "active",
  "pending",
  "suspended"
]);
var users = pgTable(
  "users",
  {
    // Supabase Auth is the identity source of truth. This id is populated from
    // auth.users.id by the on_auth_user_created database trigger.
    id: uuid("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    role: userRoleEnum("role").notNull().default("customer"),
    status: userStatusEnum("status").notNull().default("pending"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    index("users_role_idx").on(t.role)
  ]
);
var profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }),
    avatar: text("avatar"),
    bio: text("bio"),
    preferences: jsonb("preferences").$type().default({}),
    locale: varchar("locale", { length: 16 }).notNull().default("fa"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Tehran"),
    ...timestamps
  }
);
var userAddresses = pgTable(
  "user_addresses",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 60 }),
    recipientName: varchar("recipient_name", { length: 120 }),
    phone: varchar("phone", { length: 32 }),
    province: varchar("province", { length: 60 }),
    city: varchar("city", { length: 60 }),
    address: text("address").notNull(),
    postalCode: varchar("postal_code", { length: 20 }),
    latitude: varchar("latitude", { length: 32 }),
    longitude: varchar("longitude", { length: 32 }),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps
  },
  (t) => [index("user_addresses_user_idx").on(t.userId)]
);

// src/db/schema/vendors.ts
var vendors_exports = {};
__export(vendors_exports, {
  vendorMemberRoleEnum: () => vendorMemberRoleEnum,
  vendorMembers: () => vendorMembers,
  vendorPayoutSettings: () => vendorPayoutSettings,
  vendorSettings: () => vendorSettings,
  vendorStatusEnum: () => vendorStatusEnum,
  vendorVerificationEnum: () => vendorVerificationEnum,
  vendors: () => vendors
});
var vendorStatusEnum = pgEnum("vendor_status", [
  "pending",
  "active",
  "suspended",
  "rejected"
]);
var vendorVerificationEnum = pgEnum("vendor_verification", [
  "unverified",
  "pending",
  "verified"
]);
var vendors = pgTable(
  "vendors",
  {
    id: id(),
    name: varchar("name", { length: 140 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    logo: text("logo"),
    cover: text("cover"),
    description: text("description"),
    status: vendorStatusEnum("status").notNull().default("pending"),
    verificationStatus: vendorVerificationEnum("verification_status").notNull().default("unverified"),
    rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
    reviewsCount: integer("reviews_count").notNull().default(0),
    salesCount: integer("sales_count").notNull().default(0),
    followersCount: integer("followers_count").notNull().default(0),
    sinceYear: integer("since_year"),
    city: varchar("city", { length: 80 }),
    badges: jsonb("badges").$type().default([]),
    shippingPolicy: text("shipping_policy"),
    returnPolicy: text("return_policy"),
    returnDays: integer("return_days").notNull().default(7),
    responseTime: varchar("response_time", { length: 60 }),
    contactEmail: varchar("contact_email", { length: 320 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    website: text("website"),
    social: jsonb("social").$type().default({}),
    metadata: jsonb("metadata").$type().default({}),
    ...timestamps
  },
  (t) => [
    uniqueIndex("vendors_slug_unique").on(t.slug),
    index("vendors_status_idx").on(t.status)
  ]
);
var vendorMemberRoleEnum = pgEnum("vendor_member_role", [
  "owner",
  "manager",
  "staff"
]);
var vendorMembers = pgTable(
  "vendor_members",
  {
    id: id(),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: vendorMemberRoleEnum("role").notNull().default("staff"),
    permissions: jsonb("permissions").$type().default([]),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("vendor_members_vendor_user_unique").on(t.vendorId, t.userId)
  ]
);
var vendorSettings = pgTable("vendor_settings", {
  vendorId: uuid("vendor_id").primaryKey().references(() => vendors.id, { onDelete: "cascade" }),
  currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
  autoConfirmOrders: boolean("auto_confirm_orders").notNull().default(true),
  dispatchTime: varchar("dispatch_time", { length: 80 }),
  shippingCoverage: varchar("shipping_coverage", { length: 120 }),
  shippingNote: text("shipping_note"),
  returnNote: text("return_note"),
  authenticityNote: text("authenticity_note"),
  notificationEmail: varchar("notification_email", { length: 320 }),
  orderNotesEnabled: boolean("order_notes_enabled").notNull().default(true),
  ...timestamps
});
var vendorPayoutSettings = pgTable("vendor_payout_settings", {
  vendorId: uuid("vendor_id").primaryKey().references(() => vendors.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 40 }).notNull().default("manual"),
  accountHolderName: varchar("account_holder_name", { length: 140 }),
  accountNumber: varchar("account_number", { length: 64 }),
  cardNumber: varchar("card_number", { length: 32 }),
  shaba: varchar("shaba", { length: 32 }),
  taxId: varchar("tax_id", { length: 32 }),
  payoutMethod: jsonb("payout_method").$type().default({}),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  ...timestamps
});

// src/db/schema/categories.ts
var categories_exports = {};
__export(categories_exports, {
  categories: () => categories,
  categoryHierarchy: () => categoryHierarchy,
  categoryRelationTypeEnum: () => categoryRelationTypeEnum,
  categoryRelations: () => categoryRelations
});
var categories = pgTable(
  "categories",
  {
    id: id(),
    parentId: uuid("parent_id"),
    slug: varchar("slug", { length: 160 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    nameEn: varchar("name_en", { length: 120 }),
    description: text("description"),
    icon: varchar("icon", { length: 48 }),
    image: text("image"),
    sortOrder: integer("sort_order").notNull().default(0),
    depth: integer("depth").notNull().default(0),
    path: varchar("path", { length: 500 }).default(""),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps
  },
  (t) => [
    uniqueIndex("categories_slug_unique").on(t.slug),
    index("categories_parent_idx").on(t.parentId),
    index("categories_active_sort_idx").on(t.isActive, t.sortOrder)
  ]
);
var categoryRelationTypeEnum = pgEnum("category_relation_type", [
  "parent",
  "child",
  "related"
]);
var categoryRelations = pgTable(
  "category_relations",
  {
    id: id(),
    categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    relatedCategoryId: uuid("related_category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    relationType: categoryRelationTypeEnum("relation_type").notNull().default("related"),
    sortOrder: integer("sort_order").notNull().default(0)
  },
  (t) => [
    uniqueIndex("category_relations_unique").on(
      t.categoryId,
      t.relatedCategoryId,
      t.relationType
    )
  ]
);
var categoryHierarchy = pgTable(
  "category_hierarchy",
  {
    ancestorId: uuid("ancestor_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    descendantId: uuid("descendant_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    depth: integer("depth").notNull().default(0)
  },
  (t) => [
    uniqueIndex("category_hierarchy_unique").on(t.ancestorId, t.descendantId),
    index("category_hierarchy_descendant_idx").on(t.descendantId)
  ]
);

// src/db/schema/products.ts
var products_exports = {};
__export(products_exports, {
  inventory: () => inventory,
  productCategories: () => productCategories,
  productImages: () => productImages,
  productStatusEnum: () => productStatusEnum,
  productStyles: () => productStyles,
  productVariants: () => productVariants,
  products: () => products
});
var productStatusEnum = pgEnum("product_status", [
  "draft",
  "active",
  "out_of_stock",
  "archived"
]);
var products = pgTable(
  "products",
  {
    id: id(),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull(),
    description: text("description"),
    shortDescription: varchar("short_description", { length: 400 }),
    price: integer("price").notNull().default(0),
    compareAtPrice: integer("compare_at_price"),
    currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
    brand: varchar("brand", { length: 120 }),
    sku: varchar("sku", { length: 120 }),
    material: varchar("material", { length: 120 }),
    color: varchar("color", { length: 80 }),
    dimensions: jsonb("dimensions").$type().default({}),
    weight: integer("weight"),
    status: productStatusEnum("status").notNull().default("draft"),
    styleSlugs: jsonb("style_slugs").$type().default([]),
    tags: jsonb("tags").$type().default([]),
    metadata: jsonb("metadata").$type().default({}),
    rating: integer("rating").notNull().default(0),
    // 0..100 (x10 percent)
    reviewsCount: integer("reviews_count").notNull().default(0),
    salesCount: integer("sales_count").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    uniqueIndex("products_slug_unique").on(t.slug),
    index("products_vendor_idx").on(t.vendorId),
    index("products_status_price_idx").on(t.status, t.price)
  ]
);
var productImages = pgTable(
  "product_images",
  {
    id: id(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    position: integer("position").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false)
  },
  (t) => [index("product_images_product_idx").on(t.productId)]
);
var productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull().default("\u067E\u06CC\u0634\u200C\u0641\u0631\u0636"),
    sku: varchar("sku", { length: 120 }),
    attributes: jsonb("attributes").$type().default({}),
    priceDelta: integer("price_delta").notNull().default(0),
    image: text("image"),
    isActive: boolean("is_active").notNull().default(true)
  },
  (t) => [index("product_variants_product_idx").on(t.productId)]
);
var productCategories = pgTable(
  "product_categories",
  {
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false)
  },
  (t) => [
    uniqueIndex("product_categories_pk").on(t.productId, t.categoryId),
    index("product_categories_category_idx").on(t.categoryId)
  ]
);
var productStyles = pgTable(
  "product_styles",
  {
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    styleSlug: varchar("style_slug", { length: 48 }).notNull()
  },
  (t) => [
    uniqueIndex("product_styles_pk").on(t.productId, t.styleSlug),
    index("product_styles_slug_idx").on(t.styleSlug)
  ]
);
var inventory = pgTable(
  "inventory",
  {
    id: id(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade"
    }),
    quantity: integer("quantity").notNull().default(0),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    warehouse: varchar("warehouse", { length: 60 }).notNull().default("main"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("inventory_product_variant_unique").on(t.productId, t.variantId),
    index("inventory_low_stock_idx").on(t.productId, t.quantity)
  ]
);

// src/db/schema/commerce.ts
var commerce_exports = {};
__export(commerce_exports, {
  cartItems: () => cartItems,
  cartStatusEnum: () => cartStatusEnum,
  carts: () => carts,
  comparisonItems: () => comparisonItems,
  comparisonLists: () => comparisonLists,
  itemStatusEnum: () => itemStatusEnum,
  orderItems: () => orderItems,
  orderStatusEnum: () => orderStatusEnum,
  orderStatusHistory: () => orderStatusHistory,
  orders: () => orders,
  paymentStatusEnum: () => paymentStatusEnum,
  paymentTransactions: () => paymentTransactions,
  paymentTxTypeEnum: () => paymentTxTypeEnum,
  payments: () => payments,
  refundStatusEnum: () => refundStatusEnum,
  refunds: () => refunds,
  reviewStatusEnum: () => reviewStatusEnum,
  reviews: () => reviews,
  wishlistItems: () => wishlistItems,
  wishlists: () => wishlists
});
var cartStatusEnum = pgEnum("cart_status", [
  "active",
  "abandoned",
  "converted"
]);
var carts = pgTable(
  "carts",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: cartStatusEnum("status").notNull().default("active"),
    ...timestamps
  },
  (t) => [
    uniqueIndex("carts_active_user_unique").on(t.userId, t.status),
    index("carts_user_idx").on(t.userId)
  ]
);
var cartItems = pgTable(
  "cart_items",
  {
    id: id(),
    cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null"
    }),
    quantity: integer("quantity").notNull().default(1),
    priceSnapshot: integer("price_snapshot").notNull(),
    // price frozen at add time
    currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
    addedAt: createdAtColumn
  },
  (t) => [
    uniqueIndex("cart_items_unique").on(t.cartId, t.productId, t.variantId),
    index("cart_items_cart_idx").on(t.cartId)
  ]
);
var orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded"
]);
var itemStatusEnum = pgEnum("item_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded"
]);
var orders = pgTable(
  "orders",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    orderNumber: varchar("order_number", { length: 40 }).notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    subtotal: integer("subtotal").notNull().default(0),
    shippingTotal: integer("shipping_total").notNull().default(0),
    discountTotal: integer("discount_total").notNull().default(0),
    taxTotal: integer("tax_total").notNull().default(0),
    total: integer("total").notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
    shippingAddress: jsonb("shipping_address").$type(),
    billingAddress: jsonb("billing_address").$type(),
    customerNote: text("customer_note"),
    placedAt: createdAtColumn,
    ...timestamps
  },
  (t) => [
    uniqueIndex("orders_order_number_unique").on(t.orderNumber),
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status)
  ]
);
var orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null"
    }),
    // snapshots (order must survive catalog edits)
    titleSnapshot: text("title_snapshot").notNull(),
    skuSnapshot: varchar("sku_snapshot", { length: 120 }),
    imageSnapshot: text("image_snapshot"),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull().default(1),
    total: integer("total").notNull().default(0),
    status: itemStatusEnum("status").notNull().default("pending"),
    refundedAmount: integer("refunded_amount").notNull().default(0)
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_vendor_idx").on(t.vendorId),
    index("order_items_product_idx").on(t.productId)
  ]
);
var orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    actorId: uuid("actor_id"),
    note: text("note"),
    createdAt: createdAtColumn
  },
  (t) => [index("order_status_history_order_idx").on(t.orderId)]
);
var paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded"
]);
var payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 40 }).notNull(),
    providerPaymentId: varchar("provider_payment_id", { length: 140 }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    paidAt: createdAtColumn,
    ...timestamps
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    index("payments_provider_ref_idx").on(t.provider, t.providerPaymentId)
  ]
);
var paymentTxTypeEnum = pgEnum("payment_tx_type", [
  "authorize",
  "capture",
  "refund",
  "reversal"
]);
var paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: id(),
    paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
    type: paymentTxTypeEnum("type").notNull(),
    providerReference: varchar("provider_reference", { length: 140 }),
    amount: integer("amount").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    payload: jsonb("payload").$type().default({}),
    createdAt: createdAtColumn
  },
  (t) => [index("payment_transactions_payment_idx").on(t.paymentId)]
);
var refundStatusEnum = pgEnum("refund_status", [
  "requested",
  "approved",
  "processed",
  "rejected"
]);
var refunds = pgTable(
  "refunds",
  {
    id: id(),
    paymentId: uuid("payment_id").references(() => payments.id, {
      onDelete: "set null"
    }),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    reason: text("reason"),
    status: refundStatusEnum("status").notNull().default("requested"),
    processedBy: uuid("processed_by"),
    refundedAt: createdAtColumn,
    ...timestamps
  },
  (t) => [index("refunds_order_idx").on(t.orderId)]
);
var wishlists = pgTable(
  "wishlists",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ...timestamps
  },
  (t) => [uniqueIndex("wishlists_user_unique").on(t.userId)]
);
var wishlistItems = pgTable(
  "wishlist_items",
  {
    wishlistId: uuid("wishlist_id").notNull().references(() => wishlists.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    addedAt: createdAtColumn
  },
  (t) => [
    uniqueIndex("wishlist_items_pk").on(t.wishlistId, t.productId),
    index("wishlist_items_product_idx").on(t.productId)
  ]
);
var comparisonLists = pgTable("comparison_lists", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull().default("\u0645\u0642\u0627\u06CC\u0633\u0647"),
  ...timestamps
});
var comparisonItems = pgTable(
  "comparison_items",
  {
    comparisonListId: uuid("comparison_list_id").notNull().references(() => comparisonLists.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    addedAt: createdAtColumn
  },
  (t) => [
    uniqueIndex("comparison_items_pk").on(t.comparisonListId, t.productId)
  ]
);
var reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected"
]);
var reviews = pgTable(
  "reviews",
  {
    id: id(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, {
      onDelete: "set null"
    }),
    rating: integer("rating").notNull(),
    // 1..5
    title: varchar("title", { length: 160 }),
    content: text("content"),
    verifiedPurchase: boolean("verified_purchase").notNull().default(false),
    helpfulCount: integer("helpful_count").notNull().default(0),
    status: reviewStatusEnum("status").notNull().default("pending"),
    ...timestamps
  },
  (t) => [
    uniqueIndex("reviews_user_product_unique").on(t.userId, t.productId),
    index("reviews_product_status_idx").on(t.productId, t.status)
  ]
);

// src/db/schema/ai.ts
var ai_exports = {};
__export(ai_exports, {
  aiAssetKindEnum: () => aiAssetKindEnum,
  aiAssets: () => aiAssets,
  aiDesignStatusEnum: () => aiDesignStatusEnum,
  aiDesigns: () => aiDesigns,
  aiGenerationStatusEnum: () => aiGenerationStatusEnum,
  aiGenerations: () => aiGenerations,
  aiModels: () => aiModels,
  aiPricing: () => aiPricing,
  aiProviderTypeEnum: () => aiProviderTypeEnum,
  aiProviders: () => aiProviders,
  aiUsage: () => aiUsage,
  aiUsageLogs: () => aiUsageLogs,
  creditAccounts: () => creditAccounts,
  creditTransactions: () => creditTransactions,
  creditTxStatusEnum: () => creditTxStatusEnum,
  creditTxTypeEnum: () => creditTxTypeEnum
});
var aiAssetKindEnum = pgEnum("ai_asset_kind", [
  "original",
  "generated",
  "overlay",
  "mask",
  "thumbnail",
  "reference"
]);
var aiAssets = pgTable(
  "ai_assets",
  {
    id: id(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    kind: aiAssetKindEnum("kind").notNull(),
    mimeType: varchar("mime_type", { length: 64 }),
    sizeBytes: integer("size_bytes"),
    url: text("url").notNull(),
    storageProvider: varchar("storage_provider", { length: 40 }).notNull().default("local"),
    storageKey: text("storage_key"),
    width: integer("width"),
    height: integer("height"),
    checksum: varchar("checksum", { length: 64 }),
    metadata: jsonb("metadata").$type().default({}),
    createdAt: createdAtColumn
  },
  (t) => [
    index("ai_assets_owner_idx").on(t.ownerId),
    index("ai_assets_kind_idx").on(t.kind)
  ]
);
var aiDesignStatusEnum = pgEnum("ai_design_status", [
  "processing",
  "completed",
  "failed"
]);
var aiDesigns = pgTable(
  "ai_designs",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull().default("\u0637\u0631\u0627\u062D\u06CC \u0628\u062F\u0648\u0646 \u0646\u0627\u0645"),
    mode: varchar("mode", { length: 40 }).notNull(),
    status: aiDesignStatusEnum("status").notNull().default("processing"),
    roomType: varchar("room_type", { length: 60 }),
    style: varchar("style", { length: 60 }),
    prompt: text("prompt"),
    originalImageId: uuid("original_image_id").references(() => aiAssets.id, {
      onDelete: "set null"
    }),
    currentImageId: uuid("current_image_id").references(() => aiAssets.id, {
      onDelete: "set null"
    }),
    metadata: jsonb("metadata").$type().default({}),
    creditsUsed: integer("credits_used").notNull().default(0),
    ...timestamps
  },
  (t) => [
    index("ai_designs_user_idx").on(t.userId),
    index("ai_designs_status_idx").on(t.status)
  ]
);
var aiGenerationStatusEnum = pgEnum("ai_generation_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled"
]);
var aiGenerations = pgTable(
  "ai_generations",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    designId: uuid("design_id").references(() => aiDesigns.id, {
      onDelete: "set null"
    }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null"
    }),
    prompt: text("prompt"),
    intent: jsonb("intent").$type(),
    target: varchar("target", { length: 120 }),
    preservedElements: jsonb("preserved_elements").$type().default([]),
    requestedChanges: jsonb("requested_changes").$type().default([]),
    provider: varchar("provider", { length: 80 }),
    model: varchar("model", { length: 120 }),
    status: aiGenerationStatusEnum("status").notNull().default("queued"),
    inputAssetId: uuid("input_asset_id").references(() => aiAssets.id, {
      onDelete: "set null"
    }),
    outputAssetId: uuid("output_asset_id").references(() => aiAssets.id, {
      onDelete: "set null"
    }),
    overlayAssetId: uuid("overlay_asset_id").references(() => aiAssets.id, {
      onDelete: "set null"
    }),
    maskAssetId: uuid("mask_asset_id").references(() => aiAssets.id, {
      onDelete: "set null"
    }),
    overlayMetadata: jsonb("overlay_metadata").$type(),
    error: text("error"),
    durationMs: integer("duration_ms"),
    creditCost: integer("credit_cost").notNull().default(0),
    createdAt: createdAtColumn,
    completedAt: createdAtColumn
  },
  (t) => [
    index("ai_generations_user_idx").on(t.userId),
    index("ai_generations_design_idx").on(t.designId),
    index("ai_generations_status_idx").on(t.status)
  ]
);
var creditAccounts = pgTable("credit_accounts", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  lifetimeEarned: integer("lifetime_earned").notNull().default(0),
  lifetimeSpent: integer("lifetime_spent").notNull().default(0),
  version: integer("version").notNull().default(0),
  // optimistic lock
  updatedAt: updatedAtColumn
});
var creditTxTypeEnum = pgEnum("credit_tx_type", [
  "purchase",
  "generation",
  "refund",
  "bonus",
  "admin_adjustment",
  "expiration"
]);
var creditTxStatusEnum = pgEnum("credit_tx_status", [
  "pending",
  "committed",
  "failed"
]);
var creditTransactions = pgTable(
  "credit_transactions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: creditTxTypeEnum("type").notNull(),
    amount: integer("amount").notNull(),
    // signed; negative = spent
    balanceAfter: integer("balance_after").notNull(),
    operation: varchar("operation", { length: 120 }).notNull(),
    referenceType: varchar("reference_type", { length: 60 }),
    referenceId: uuid("reference_id"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    status: creditTxStatusEnum("status").notNull().default("committed"),
    note: text("note"),
    createdAt: createdAtColumn
  },
  (t) => [
    index("credit_transactions_user_idx").on(t.userId),
    uniqueIndex("credit_transactions_idempotency_unique").on(t.idempotencyKey),
    index("credit_transactions_ref_idx").on(t.referenceType, t.referenceId)
  ]
);
var aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    generationId: uuid("generation_id").notNull().references(() => aiGenerations.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 80 }).notNull(),
    model: varchar("model", { length: 120 }),
    action: varchar("action", { length: 60 }).notNull(),
    creditCost: integer("credit_cost").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    imageCount: integer("image_count").notNull().default(0),
    createdAt: createdAtColumn
  },
  (t) => [uniqueIndex("ai_usage_generation_unique").on(t.generationId)]
);
var aiUsage = aiUsageLogs;
var aiProviderTypeEnum = pgEnum("ai_provider_type", [
  "LLM",
  "IMAGE",
  "OVERLAY"
]);
var aiProviders = pgTable("ai_providers", {
  id: id(),
  name: varchar("name", { length: 80 }).notNull(),
  type: aiProviderTypeEnum("type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  baseUrl: text("base_url"),
  // NOTE: never store API keys here — keys come from server-side env only.
  config: jsonb("config").$type().default({}),
  healthStatus: varchar("health_status", { length: 24 }).notNull().default("unknown"),
  lastCheckedAt: createdAtColumn,
  ...timestamps
});
var aiModels = pgTable(
  "ai_models",
  {
    id: id(),
    providerId: uuid("provider_id").notNull().references(() => aiProviders.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    contextWindow: integer("context_window"),
    maxOutput: integer("max_output"),
    isActive: boolean("is_active").notNull().default(true)
  },
  (t) => [uniqueIndex("ai_models_provider_name_unique").on(t.providerId, t.name)]
);
var aiPricing = pgTable(
  "ai_pricing",
  {
    id: id(),
    providerId: uuid("provider_id").notNull().references(() => aiProviders.id, { onDelete: "cascade" }),
    modelId: uuid("model_id").references(() => aiModels.id, {
      onDelete: "set null"
    }),
    action: varchar("action", { length: 60 }).notNull(),
    // e.g. room-redesign, image-edit
    unit: varchar("unit", { length: 32 }).notNull().default("per_generation"),
    price: integer("price").notNull().default(0),
    // credits
    currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
    ...timestamps
  },
  (t) => [index("ai_pricing_provider_model_idx").on(t.providerId, t.modelId)]
);

// src/db/schema/content.ts
var content_exports = {};
__export(content_exports, {
  collectionItems: () => collectionItems,
  collectionProducts: () => collectionProducts,
  collections: () => collections,
  contentStatusEnum: () => contentStatusEnum,
  inspirations: () => inspirations,
  magazineArticles: () => magazineArticles,
  projects: () => projects
});
var contentStatusEnum = pgEnum("content_status", [
  "draft",
  "published",
  "archived"
]);
var inspirations = pgTable(
  "inspirations",
  {
    id: id(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    image: text("image"),
    styleSlug: varchar("style_slug", { length: 48 }),
    room: varchar("room", { length: 60 }),
    tags: jsonb("tags").$type().default([]),
    description: text("description"),
    productIds: jsonb("product_ids").$type().default([]),
    content: jsonb("content").$type().default({}),
    status: contentStatusEnum("status").notNull().default("draft"),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps
  },
  (t) => [
    uniqueIndex("inspirations_slug_unique").on(t.slug),
    index("inspirations_status_idx").on(t.status)
  ]
);
var projects = pgTable(
  "projects",
  {
    id: id(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    cover: text("cover"),
    description: text("description"),
    content: jsonb("content").$type().default({}),
    status: contentStatusEnum("status").notNull().default("draft"),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps
  },
  (t) => [
    uniqueIndex("projects_slug_unique").on(t.slug),
    index("projects_status_idx").on(t.status)
  ]
);
var magazineArticles = pgTable(
  "magazine_articles",
  {
    id: id(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    excerpt: text("excerpt"),
    cover: text("cover"),
    body: text("body"),
    category: varchar("category", { length: 80 }),
    tags: jsonb("tags").$type().default([]),
    status: contentStatusEnum("status").notNull().default("draft"),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps
  },
  (t) => [
    uniqueIndex("magazine_articles_slug_unique").on(t.slug),
    index("magazine_articles_status_idx").on(t.status)
  ]
);
var collections = pgTable(
  "collections",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 200 }),
    title: varchar("title", { length: 160 }).notNull(),
    subtitle: varchar("subtitle", { length: 240 }),
    image: text("image"),
    description: text("description"),
    isPublic: boolean("is_public").notNull().default(false),
    ...timestamps
  },
  (t) => [index("collections_user_idx").on(t.userId)]
);
var collectionProducts = pgTable(
  "collection_products",
  {
    collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    addedAt: createdAtColumn
  },
  (t) => [
    uniqueIndex("collection_items_pk").on(t.collectionId, t.productId),
    index("collection_products_product_idx").on(t.productId)
  ]
);
var collectionItems = collectionProducts;

// src/db/schema/system.ts
var system_exports = {};
__export(system_exports, {
  auditLogs: () => auditLogs,
  notifications: () => notifications,
  systemSettings: () => systemSettings
});
var auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 120 }).notNull(),
    entity: varchar("entity", { length: 60 }),
    entityId: varchar("entity_id", { length: 64 }),
    before: jsonb("before").$type(),
    after: jsonb("after").$type(),
    ip: varchar("ip", { length: 64 }),
    createdAt: createdAtColumn
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entity, t.entityId),
    index("audit_logs_actor_idx").on(t.actorId),
    index("audit_logs_action_idx").on(t.action)
  ]
);
var notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 60 }).notNull(),
    title: varchar("title", { length: 200 }),
    body: text("body"),
    data: jsonb("data").$type().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAtColumn
  },
  (t) => [
    index("notifications_user_idx").on(t.userId),
    index("notifications_user_read_idx").on(t.userId, t.readAt)
  ]
);
var systemSettings = pgTable("system_settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: jsonb("value").$type().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAtColumn
});

// src/db/schema/agents.ts
var agents_exports = {};
__export(agents_exports, {
  agentApprovals: () => agentApprovals,
  agentBudgets: () => agentBudgets,
  agentPermissions: () => agentPermissions,
  agentRuns: () => agentRuns,
  agentStatusEnum: () => agentStatusEnum,
  agentTaskLogs: () => agentTaskLogs,
  agentTasks: () => agentTasks,
  agentToolGrants: () => agentToolGrants,
  agentTools: () => agentTools,
  agentTypeEnum: () => agentTypeEnum,
  agents: () => agents,
  analyticsEvents: () => analyticsEvents,
  approvalStatusEnum: () => approvalStatusEnum,
  budgetScopeEnum: () => budgetScopeEnum,
  customerMemories: () => customerMemories,
  customerProfiles: () => customerProfiles,
  embeddingEntityEnum: () => embeddingEntityEnum,
  entityEmbeddings: () => entityEmbeddings,
  integrationConnections: () => integrationConnections,
  memoryKindEnum: () => memoryKindEnum,
  recommendationStatusEnum: () => recommendationStatusEnum,
  recommendations: () => recommendations,
  riskLevelEnum: () => riskLevelEnum,
  runStatusEnum: () => runStatusEnum,
  stepStatusEnum: () => stepStatusEnum,
  taskStatusEnum: () => taskStatusEnum,
  triggerKindEnum: () => triggerKindEnum,
  workflowEdges: () => workflowEdges,
  workflowNodeTypeEnum: () => workflowNodeTypeEnum,
  workflowNodes: () => workflowNodes,
  workflowRunSteps: () => workflowRunSteps,
  workflowRuns: () => workflowRuns,
  workflowStatusEnum: () => workflowStatusEnum,
  workflows: () => workflows
});
var agentTypeEnum = pgEnum("agent_type", [
  "analyzer",
  "generator",
  "executor",
  "assistant",
  "browser",
  "notifier"
]);
var agentStatusEnum = pgEnum("agent_status", [
  "draft",
  "active",
  "paused",
  "archived"
]);
var workflowStatusEnum = pgEnum("workflow_status", [
  "draft",
  "active",
  "paused",
  "archived"
]);
var workflowNodeTypeEnum = pgEnum("workflow_node_type", [
  "trigger",
  "condition",
  "agent",
  "db_query",
  "db_update",
  "recommendation",
  "notification",
  "delay",
  "schedule",
  "human_approval",
  "http_request",
  "browser_task",
  "end"
]);
var runStatusEnum = pgEnum("agent_run_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "waiting_approval"
]);
var stepStatusEnum = pgEnum("agent_step_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
  "cancelled",
  "waiting_approval"
]);
var taskStatusEnum = pgEnum("agent_task_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "waiting_approval",
  "cancelled"
]);
var approvalStatusEnum = pgEnum("agent_approval_status", [
  "pending",
  "approved",
  "rejected",
  "expired"
]);
var riskLevelEnum = pgEnum("agent_risk_level", [
  "low",
  "medium",
  "high",
  "critical"
]);
var recommendationStatusEnum = pgEnum("recommendation_status", [
  "active",
  "dismissed",
  "converted",
  "expired"
]);
var memoryKindEnum = pgEnum("customer_memory_kind", [
  "preference",
  "interaction",
  "design",
  "request",
  "recommendation",
  "dismissal",
  "purchase",
  "note"
]);
var embeddingEntityEnum = pgEnum("embedding_entity", [
  "product",
  "customer",
  "room",
  "style",
  "query"
]);
var budgetScopeEnum = pgEnum("agent_budget_scope", [
  "global",
  "agent",
  "workflow",
  "user"
]);
var triggerKindEnum = pgEnum("workflow_trigger_kind", [
  "event",
  "schedule",
  "manual",
  "webhook"
]);
var agents = pgTable(
  "agents",
  {
    id: id(),
    /** Stable machine key, e.g. `customer-intelligence`. */
    key: varchar("key", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    type: agentTypeEnum("type").notNull().default("analyzer"),
    status: agentStatusEnum("status").notNull().default("draft"),
    /** Logical model id — resolved by the LLM gateway at run time. */
    model: varchar("model", { length: 120 }),
    /** Optional runtime override: local | dify | langflow | ollama. */
    runtime: varchar("runtime", { length: 40 }).notNull().default("local"),
    systemPrompt: text("system_prompt"),
    /** Handler key inside the built-in agent registry (`defaults.ts`). */
    handler: varchar("handler", { length: 80 }),
    config: jsonb("config").$type().default({}),
    schedule: jsonb("schedule").$type(),
    maxRetries: integer("max_retries").notNull().default(2),
    timeoutMs: integer("timeout_ms").notNull().default(3e4),
    /** Micro-cost ceiling for a single run (0 = inherit budget table). */
    maxCostMicro: integer("max_cost_micro").notNull().default(0),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps
  },
  (t) => [
    uniqueIndex("agents_key_unique").on(t.key),
    index("agents_status_idx").on(t.status),
    index("agents_type_idx").on(t.type)
  ]
);
var agentTools = pgTable(
  "agent_tools",
  {
    id: id(),
    key: varchar("key", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 60 }).notNull().default("general"),
    /** Permission required to call this tool (see permissions.ts). */
    requiredPermission: varchar("required_permission", { length: 80 }).notNull(),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    isDestructive: boolean("is_destructive").notNull().default(false),
    inputSchema: jsonb("input_schema").$type().default({}),
    isActive: boolean("is_active").notNull().default(true),
    isBuiltin: boolean("is_builtin").notNull().default(true),
    ...timestamps
  },
  (t) => [uniqueIndex("agent_tools_key_unique").on(t.key)]
);
var agentToolGrants = pgTable(
  "agent_tool_grants",
  {
    id: id(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    toolKey: varchar("tool_key", { length: 80 }).notNull(),
    /** Per-grant overrides (limits, allowlists). */
    config: jsonb("config").$type().default({}),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAtColumn
  },
  (t) => [
    uniqueIndex("agent_tool_grants_unique").on(t.agentId, t.toolKey),
    index("agent_tool_grants_agent_idx").on(t.agentId)
  ]
);
var agentPermissions = pgTable(
  "agent_permissions",
  {
    id: id(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    permission: varchar("permission", { length: 80 }).notNull(),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAtColumn
  },
  (t) => [
    uniqueIndex("agent_permissions_unique").on(t.agentId, t.permission),
    index("agent_permissions_agent_idx").on(t.agentId)
  ]
);
var workflows = pgTable(
  "workflows",
  {
    id: id(),
    key: varchar("key", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    status: workflowStatusEnum("status").notNull().default("draft"),
    /** Where this workflow executes: local engine · Dify · Langflow. */
    runtime: varchar("runtime", { length: 30 }).notNull().default("local"),
    version: integer("version").notNull().default(1),
    triggerKind: triggerKindEnum("trigger_kind").notNull().default("manual"),
    /** { eventTypes: string[], condition?: {...} } for event triggers. */
    trigger: jsonb("trigger").$type().default({}),
    /** { kind: "manual"|"interval"|"daily"|"weekly"|"cron", ... } */
    schedule: jsonb("schedule").$type(),
    config: jsonb("config").$type().default({}),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    uniqueIndex("workflows_key_unique").on(t.key),
    index("workflows_status_idx").on(t.status),
    index("workflows_next_run_idx").on(t.nextRunAt)
  ]
);
var workflowNodes = pgTable(
  "workflow_nodes",
  {
    id: id(),
    workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
    /** Local node key, unique inside the workflow (e.g. `n1`). */
    nodeKey: varchar("node_key", { length: 40 }).notNull(),
    type: workflowNodeTypeEnum("type").notNull(),
    label: varchar("label", { length: 160 }),
    /** Agent key when type = 'agent'. */
    agentKey: varchar("agent_key", { length: 80 }),
    config: jsonb("config").$type().default({}),
    position: jsonb("position").$type().default({ x: 0, y: 0 }),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn
  },
  (t) => [
    uniqueIndex("workflow_nodes_key_unique").on(t.workflowId, t.nodeKey),
    index("workflow_nodes_workflow_idx").on(t.workflowId)
  ]
);
var workflowEdges = pgTable(
  "workflow_edges",
  {
    id: id(),
    workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
    fromNode: varchar("from_node", { length: 40 }).notNull(),
    toNode: varchar("to_node", { length: 40 }).notNull(),
    /** Optional branch label: `true` | `false` | custom. */
    conditionLabel: varchar("condition_label", { length: 40 }),
    orderIndex: integer("order_index").notNull().default(0)
  },
  (t) => [
    uniqueIndex("workflow_edges_unique").on(t.workflowId, t.fromNode, t.toNode, t.conditionLabel),
    index("workflow_edges_workflow_idx").on(t.workflowId)
  ]
);
var workflowRuns = pgTable(
  "workflow_runs",
  {
    id: id(),
    workflowId: uuid("workflow_id").references(() => workflows.id, {
      onDelete: "set null"
    }),
    workflowKey: varchar("workflow_key", { length: 80 }),
    status: runStatusEnum("status").notNull().default("queued"),
    triggerKind: triggerKindEnum("trigger_kind").notNull().default("manual"),
    triggerPayload: jsonb("trigger_payload").$type().default({}),
    input: jsonb("input").$type().default({}),
    output: jsonb("output").$type(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionId: varchar("session_id", { length: 80 }),
    attempt: integer("attempt").notNull().default(1),
    maxAttempts: integer("max_attempts").notNull().default(1),
    error: text("error"),
    errorCode: varchar("error_code", { length: 60 }),
    toolsUsed: jsonb("tools_used").$type().default([]),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    /** Estimated cost in micro units (1/1_000_000). Integer, never float. */
    costMicro: integer("cost_micro").notNull().default(0),
    model: varchar("model", { length: 120 }),
    provider: varchar("provider", { length: 60 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    cancelledBy: uuid("cancelled_by").references(() => users.id, { onDelete: "set null" })
  },
  (t) => [
    index("workflow_runs_workflow_idx").on(t.workflowId),
    index("workflow_runs_status_idx").on(t.status),
    index("workflow_runs_started_idx").on(t.startedAt),
    index("workflow_runs_user_idx").on(t.userId)
  ]
);
var workflowRunSteps = pgTable(
  "workflow_run_steps",
  {
    id: id(),
    runId: uuid("run_id").notNull().references(() => workflowRuns.id, { onDelete: "cascade" }),
    nodeKey: varchar("node_key", { length: 40 }).notNull(),
    nodeType: workflowNodeTypeEnum("type").notNull(),
    label: varchar("label", { length: 160 }),
    agentKey: varchar("agent_key", { length: 80 }),
    status: stepStatusEnum("status").notNull().default("pending"),
    attempt: integer("attempt").notNull().default(1),
    input: jsonb("input").$type(),
    output: jsonb("output").$type(),
    error: text("error"),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costMicro: integer("cost_micro").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms")
  },
  (t) => [index("workflow_run_steps_run_idx").on(t.runId)]
);
var agentRuns = pgTable(
  "agent_runs",
  {
    id: id(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    agentKey: varchar("agent_key", { length: 80 }).notNull(),
    runId: uuid("run_id").references(() => workflowRuns.id, { onDelete: "cascade" }),
    taskId: uuid("task_id"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    status: runStatusEnum("status").notNull().default("queued"),
    input: jsonb("input").$type().default({}),
    output: jsonb("output").$type(),
    toolsUsed: jsonb("tools_used").$type().default([]),
    provider: varchar("provider", { length: 60 }),
    model: varchar("model", { length: 120 }),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costMicro: integer("cost_micro").notNull().default(0),
    durationMs: integer("duration_ms"),
    attempt: integer("attempt").notNull().default(1),
    error: text("error"),
    errorCode: varchar("error_code", { length: 60 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true })
  },
  (t) => [
    index("agent_runs_agent_idx").on(t.agentKey),
    index("agent_runs_run_idx").on(t.runId),
    index("agent_runs_status_idx").on(t.status),
    index("agent_runs_started_idx").on(t.startedAt)
  ]
);
var agentTasks = pgTable(
  "agent_tasks",
  {
    id: id(),
    title: varchar("title", { length: 200 }).notNull(),
    type: varchar("type", { length: 80 }).notNull().default("generic"),
    status: taskStatusEnum("status").notNull().default("pending"),
    priority: integer("priority").notNull().default(0),
    agentKey: varchar("agent_key", { length: 80 }),
    workflowRunId: uuid("workflow_run_id").references(() => workflowRuns.id, {
      onDelete: "set null"
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type().default({}),
    result: jsonb("result").$type(),
    error: text("error"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    assigneeRole: varchar("assignee_role", { length: 40 }).notNull().default("admin"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps
  },
  (t) => [
    index("agent_tasks_status_idx").on(t.status),
    index("agent_tasks_agent_idx").on(t.agentKey),
    index("agent_tasks_priority_idx").on(t.priority, t.createdAt)
  ]
);
var agentTaskLogs = pgTable(
  "agent_task_logs",
  {
    id: id(),
    taskId: uuid("task_id").notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
    level: varchar("level", { length: 16 }).notNull().default("info"),
    message: text("message").notNull(),
    meta: jsonb("meta").$type().default({}),
    createdAt: createdAtColumn
  },
  (t) => [index("agent_task_logs_task_idx").on(t.taskId)]
);
var agentApprovals = pgTable(
  "agent_approvals",
  {
    id: id(),
    agentKey: varchar("agent_key", { length: 80 }),
    taskId: uuid("task_id").references(() => agentTasks.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => workflowRuns.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 120 }).notNull(),
    reason: text("reason"),
    riskLevel: riskLevelEnum("risk_level").notNull().default("medium"),
    payload: jsonb("payload").$type().default({}),
    status: approvalStatusEnum("status").notNull().default("pending"),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decisionNote: text("decision_note"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAtColumn
  },
  (t) => [
    index("agent_approvals_status_idx").on(t.status),
    index("agent_approvals_task_idx").on(t.taskId)
  ]
);
var agentBudgets = pgTable(
  "agent_budgets",
  {
    id: id(),
    scope: budgetScopeEnum("scope").notNull().default("global"),
    /** agent key / workflow key / user id — null for global. */
    scopeKey: varchar("scope_key", { length: 120 }),
    dailyLimitMicro: integer("daily_limit_micro").notNull().default(0),
    monthlyLimitMicro: integer("monthly_limit_micro").notNull().default(0),
    perRunLimitMicro: integer("per_run_limit_micro").notNull().default(0),
    maxRunsPerDay: integer("max_runs_per_day").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps
  },
  (t) => [uniqueIndex("agent_budgets_scope_unique").on(t.scope, t.scopeKey)]
);
var customerProfiles = pgTable(
  "customer_profiles",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    preferredStyles: jsonb("preferred_styles").$type().default([]),
    preferredColors: jsonb("preferred_colors").$type().default([]),
    preferredCategories: jsonb("preferred_categories").$type().default([]),
    preferredMaterials: jsonb("preferred_materials").$type().default([]),
    preferredRooms: jsonb("preferred_rooms").$type().default([]),
    preferredStores: jsonb("preferred_stores").$type().default([]),
    preferredPriceMin: integer("preferred_price_min"),
    preferredPriceMax: integer("preferred_price_max"),
    recentInterests: jsonb("recent_interests").$type().default([]),
    purchasePatterns: jsonb("purchase_patterns").$type().default([]),
    /** 0..100 — how much real evidence backs this profile. */
    confidence: integer("confidence").notNull().default(0),
    eventCount: integer("event_count").notNull().default(0),
    source: varchar("source", { length: 60 }).notNull().default("agent"),
    lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),
    ...timestamps
  },
  (t) => [index("customer_profiles_confidence_idx").on(t.confidence)]
);
var customerMemories = pgTable(
  "customer_memories",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: memoryKindEnum("kind").notNull().default("note"),
    /** Stable dedupe key inside (user, kind) — e.g. `style:modern`. */
    memoryKey: varchar("memory_key", { length: 160 }).notNull(),
    value: jsonb("value").$type().default({}),
    text: text("text"),
    importance: integer("importance").notNull().default(1),
    hits: integer("hits").notNull().default(0),
    entityType: varchar("entity_type", { length: 40 }),
    entityId: varchar("entity_id", { length: 80 }),
    agentKey: varchar("agent_key", { length: 80 }),
    runId: uuid("run_id").references(() => workflowRuns.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps
  },
  (t) => [
    uniqueIndex("customer_memories_unique").on(t.userId, t.kind, t.memoryKey),
    index("customer_memories_user_idx").on(t.userId),
    index("customer_memories_kind_idx").on(t.kind)
  ]
);
var recommendations = pgTable(
  "recommendations",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 80 }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    /** Placement scenario: home | product_detail | cart | wishlist | search | account | ai_designer */
    scenario: varchar("scenario", { length: 60 }).notNull().default("home"),
    score: doublePrecision("score").notNull().default(0),
    rank: integer("rank").notNull().default(0),
    reasonCode: varchar("reason_code", { length: 80 }),
    reasonText: varchar("reason_text", { length: 240 }),
    breakdown: jsonb("breakdown").$type().default({}),
    agentKey: varchar("agent_key", { length: 80 }),
    runId: uuid("run_id").references(() => workflowRuns.id, { onDelete: "set null" }),
    contextSnapshot: jsonb("context_snapshot").$type().default({}),
    status: recommendationStatusEnum("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAtColumn
  },
  (t) => [
    index("recommendations_user_idx").on(t.userId, t.scenario, t.status),
    index("recommendations_session_idx").on(t.sessionId),
    index("recommendations_product_idx").on(t.productId),
    index("recommendations_created_idx").on(t.createdAt)
  ]
);
var analyticsEvents = pgTable(
  "analytics_events",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionId: varchar("session_id", { length: 80 }),
    anonymousId: varchar("anonymous_id", { length: 80 }),
    eventType: varchar("event_type", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }),
    entityId: varchar("entity_id", { length: 120 }),
    path: varchar("path", { length: 300 }),
    metadata: jsonb("metadata").$type().default({}),
    device: varchar("device", { length: 20 }),
    platform: varchar("platform", { length: 20 }),
    /** Set once a workflow consumed the event (trigger fan-out bookkeeping). */
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: createdAtColumn
  },
  (t) => [
    index("analytics_events_type_idx").on(t.eventType, t.createdAt),
    index("analytics_events_user_idx").on(t.userId, t.createdAt),
    index("analytics_events_session_idx").on(t.sessionId),
    index("analytics_events_entity_idx").on(t.entityType, t.entityId)
  ]
);
var entityEmbeddings = pgTable(
  "entity_embeddings",
  {
    id: id(),
    entityType: embeddingEntityEnum("entity_type").notNull(),
    entityId: varchar("entity_id", { length: 120 }).notNull(),
    model: varchar("model", { length: 120 }).notNull().default("homeino-lexical-v1"),
    dims: integer("dims").notNull().default(0),
    embedding: doublePrecision("embedding").array().notNull(),
    sourceText: text("source_text"),
    metadata: jsonb("metadata").$type().default({}),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn
  },
  (t) => [
    uniqueIndex("entity_embeddings_unique").on(t.entityType, t.entityId, t.model),
    index("entity_embeddings_type_idx").on(t.entityType)
  ]
);
var integrationConnections = pgTable(
  "integration_connections",
  {
    id: id(),
    provider: varchar("provider", { length: 40 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    baseUrl: text("base_url"),
    /** e.g. `DIFY_API_KEY` — the value stays in the server environment. */
    secretEnvVar: varchar("secret_env_var", { length: 80 }),
    authScheme: varchar("auth_scheme", { length: 40 }).notNull().default("bearer"),
    config: jsonb("config").$type().default({}),
    capabilities: jsonb("capabilities").$type().default([]),
    isActive: boolean("is_active").notNull().default(false),
    healthStatus: varchar("health_status", { length: 24 }).notNull().default("unknown"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    ...timestamps
  },
  (t) => [uniqueIndex("integration_connections_provider_unique").on(t.provider)]
);

// src/db/schema/supabase.ts
var supabase_exports = {};
__export(supabase_exports, {
  aiConversations: () => aiConversations,
  aiDesignHistory: () => aiDesignHistory,
  aiDesignOverlays: () => aiDesignOverlays,
  aiDesignProducts: () => aiDesignProducts,
  aiDesignRooms: () => aiDesignRooms,
  aiGenerationAssets: () => aiGenerationAssets,
  aiGenerationInputs: () => aiGenerationInputs,
  aiGenerationOutputs: () => aiGenerationOutputs,
  aiMessages: () => aiMessages,
  creditPackages: () => creditPackages,
  creditUsage: () => creditUsage,
  inspirationImages: () => inspirationImages,
  inspirationProducts: () => inspirationProducts,
  inspirationStyles: () => inspirationStyles,
  materials: () => materials,
  productAttributes: () => productAttributes,
  productMaterials: () => productMaterials,
  styleColors: () => styleColors,
  styleFeatures: () => styleFeatures,
  styleMaterials: () => styleMaterials,
  styles: () => styles,
  userPreferences: () => userPreferences,
  vendorProfiles: () => vendorProfiles
});
var userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  language: varchar("language", { length: 16 }).notNull().default("fa"),
  currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
  theme: varchar("theme", { length: 24 }).notNull().default("system"),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  pushNotifications: boolean("push_notifications").notNull().default(true),
  personalization: jsonb("personalization").$type().default({}),
  ...timestamps
});
var vendorProfiles = pgTable("vendor_profiles", {
  vendorId: uuid("vendor_id").primaryKey().references(() => vendors.id, { onDelete: "cascade" }),
  legalName: varchar("legal_name", { length: 180 }),
  registrationNumber: varchar("registration_number", { length: 80 }),
  taxId: varchar("tax_id", { length: 80 }),
  fulfilledOrders: integer("fulfilled_orders").notNull().default(0),
  responseRate: integer("response_rate").notNull().default(0),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps
});
var styles = pgTable("styles", {
  id: id(),
  slug: varchar("slug", { length: 80 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  nameEn: varchar("name_en", { length: 120 }),
  tagline: text("tagline"),
  shortDescription: text("short_description"),
  description: text("description"),
  image: text("image"),
  imageAlt: text("image_alt"),
  furnitureCharacteristics: text("furniture_characteristics"),
  lightingCharacteristics: text("lighting_characteristics"),
  formCharacteristics: text("form_characteristics"),
  decorCharacteristics: text("decor_characteristics"),
  visualDensity: text("visual_density"),
  suitableFor: text("suitable_for"),
  suitableRooms: jsonb("suitable_rooms").$type().default([]),
  comparisonNote: text("comparison_note"),
  isPublished: boolean("is_published").notNull().default(false),
  ...timestamps
}, (t) => [uniqueIndex("styles_slug_unique").on(t.slug)]);
var styleFeatures = pgTable("style_features", {
  id: id(),
  styleId: uuid("style_id").notNull().references(() => styles.id, { onDelete: "cascade" }),
  feature: varchar("feature", { length: 240 }).notNull(),
  position: integer("position").notNull().default(0)
}, (t) => [index("style_features_style_idx").on(t.styleId)]);
var styleMaterials = pgTable("style_materials", {
  styleId: uuid("style_id").notNull().references(() => styles.id, { onDelete: "cascade" }),
  material: varchar("material", { length: 120 }).notNull(),
  position: integer("position").notNull().default(0)
}, (t) => [primaryKey({ columns: [t.styleId, t.material] })]);
var styleColors = pgTable("style_colors", {
  id: id(),
  styleId: uuid("style_id").notNull().references(() => styles.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  hex: varchar("hex", { length: 9 }).notNull(),
  position: integer("position").notNull().default(0)
}, (t) => [index("style_colors_style_idx").on(t.styleId)]);
var productAttributes = pgTable("product_attributes", {
  id: id(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  value: text("value").notNull(),
  position: integer("position").notNull().default(0)
}, (t) => [index("product_attributes_product_idx").on(t.productId)]);
var materials = pgTable("materials", {
  id: id(),
  slug: varchar("slug", { length: 100 }).notNull(),
  name: varchar("name", { length: 120 }).notNull()
}, (t) => [uniqueIndex("materials_slug_unique").on(t.slug)]);
var productMaterials = pgTable("product_materials", {
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "restrict" }),
  isPrimary: boolean("is_primary").notNull().default(false)
}, (t) => [primaryKey({ columns: [t.productId, t.materialId] }), index("product_materials_material_idx").on(t.materialId)]);
var inspirationImages = pgTable("inspiration_images", {
  id: id(),
  inspirationId: uuid("inspiration_id").notNull().references(() => inspirations.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  alt: text("alt"),
  position: integer("position").notNull().default(0)
}, (t) => [index("inspiration_images_parent_idx").on(t.inspirationId)]);
var inspirationStyles = pgTable("inspiration_styles", {
  inspirationId: uuid("inspiration_id").notNull().references(() => inspirations.id, { onDelete: "cascade" }),
  styleId: uuid("style_id").notNull().references(() => styles.id, { onDelete: "cascade" })
}, (t) => [primaryKey({ columns: [t.inspirationId, t.styleId] })]);
var inspirationProducts = pgTable("inspiration_products", {
  inspirationId: uuid("inspiration_id").notNull().references(() => inspirations.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0)
}, (t) => [primaryKey({ columns: [t.inspirationId, t.productId] }), index("inspiration_products_product_idx").on(t.productId)]);
var aiGenerationInputs = pgTable("ai_generation_inputs", {
  id: id(),
  generationId: uuid("generation_id").notNull().references(() => aiGenerations.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 40 }).notNull(),
  content: text("content"),
  metadata: jsonb("metadata").$type().default({}),
  createdAt: createdAtColumn
}, (t) => [index("ai_generation_inputs_generation_idx").on(t.generationId)]);
var aiGenerationOutputs = pgTable("ai_generation_outputs", {
  id: id(),
  generationId: uuid("generation_id").notNull().references(() => aiGenerations.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 40 }).notNull(),
  content: text("content"),
  metadata: jsonb("metadata").$type().default({}),
  createdAt: createdAtColumn
}, (t) => [index("ai_generation_outputs_generation_idx").on(t.generationId)]);
var aiGenerationAssets = pgTable("ai_generation_assets", {
  id: id(),
  generationId: uuid("generation_id").notNull().references(() => aiGenerations.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 40 }).notNull(),
  bucket: varchar("bucket", { length: 80 }).notNull(),
  objectPath: text("object_path").notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  sizeBytes: integer("size_bytes"),
  metadata: jsonb("metadata").$type().default({}),
  createdAt: createdAtColumn
}, (t) => [index("ai_generation_assets_generation_idx").on(t.generationId), index("ai_generation_assets_owner_idx").on(t.ownerId)]);
var aiDesignRooms = pgTable("ai_design_rooms", {
  id: id(),
  designId: uuid("design_id").notNull().references(() => aiDesigns.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  roomType: varchar("room_type", { length: 80 }),
  sourceImagePath: text("source_image_path"),
  currentImagePath: text("current_image_path"),
  metadata: jsonb("metadata").$type().default({}),
  ...timestamps
}, (t) => [index("ai_design_rooms_design_idx").on(t.designId)]);
var aiDesignProducts = pgTable("ai_design_products", {
  designId: uuid("design_id").notNull().references(() => aiDesigns.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  source: varchar("source", { length: 40 }).notNull().default("user"),
  addedAt: createdAtColumn
}, (t) => [primaryKey({ columns: [t.designId, t.productId] })]);
var aiDesignOverlays = pgTable("ai_design_overlays", {
  id: id(),
  designId: uuid("design_id").notNull().references(() => aiDesigns.id, { onDelete: "cascade" }),
  roomId: uuid("room_id").references(() => aiDesignRooms.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  x: integer("x").notNull().default(50),
  y: integer("y").notNull().default(50),
  scale: integer("scale").notNull().default(100),
  rotation: integer("rotation").notNull().default(0),
  zIndex: integer("z_index").notNull().default(0),
  metadata: jsonb("metadata").$type().default({}),
  ...timestamps
}, (t) => [index("ai_design_overlays_design_idx").on(t.designId)]);
var aiDesignHistory = pgTable("ai_design_history", {
  id: id(),
  designId: uuid("design_id").notNull().references(() => aiDesigns.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  label: varchar("label", { length: 160 }),
  snapshot: jsonb("snapshot").$type().notNull(),
  createdAt: createdAtColumn
}, (t) => [uniqueIndex("ai_design_history_version_unique").on(t.designId, t.version)]);
var aiConversations = pgTable("ai_conversations", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  designId: uuid("design_id").references(() => aiDesigns.id, { onDelete: "set null" }),
  title: varchar("title", { length: 200 }),
  ...timestamps
}, (t) => [index("ai_conversations_user_idx").on(t.userId)]);
var aiMessages = pgTable("ai_messages", {
  id: id(),
  conversationId: uuid("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type().default({}),
  createdAt: createdAtColumn
}, (t) => [index("ai_messages_conversation_idx").on(t.conversationId)]);
var creditPackages = pgTable("credit_packages", {
  id: id(),
  slug: varchar("slug", { length: 80 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  credits: integer("credits").notNull(),
  price: integer("price").notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps
}, (t) => [uniqueIndex("credit_packages_slug_unique").on(t.slug)]);
var creditUsage = pgTable("credit_usage", {
  id: id(),
  accountUserId: uuid("account_user_id").notNull().references(() => creditAccounts.userId, { onDelete: "cascade" }),
  transactionId: uuid("transaction_id").notNull().references(() => creditTransactions.id, { onDelete: "restrict" }),
  generationId: uuid("generation_id").references(() => aiGenerations.id, { onDelete: "set null" }),
  credits: integer("credits").notNull(),
  operation: varchar("operation", { length: 120 }).notNull(),
  metadata: jsonb("metadata").$type().default({}),
  createdAt: createdAtColumn
}, (t) => [uniqueIndex("credit_usage_transaction_unique").on(t.transactionId), index("credit_usage_generation_idx").on(t.generationId)]);

// src/db/schema.ts
var schema = {
  ...users_exports,
  ...vendors_exports,
  ...categories_exports,
  ...products_exports,
  ...commerce_exports,
  ...ai_exports,
  ...content_exports,
  ...system_exports,
  ...agents_exports,
  ...supabase_exports
};

// src/db/index.ts
var globalForDb = globalThis;
function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    throw new Error("DATABASE_URL is required");
  }
  globalForDb.__homeinoPool ??= new Pool2({
    connectionString: databaseUrl,
    // Fail fast during build/prerender when DATABASE_URL is set but unreachable.
    connectionTimeoutMillis: 2500,
    query_timeout: 2500,
    idleTimeoutMillis: 1e4,
    max: 5
  });
  return globalForDb.__homeinoPool;
}
function getDb() {
  return drizzle(getPool(), { schema });
}

// src/data/media.ts
var p = (id2, ext = "jpeg", w = 1200, h = 800) => `https://images.pexels.com/photos/${id2}/pexels-photo-${id2}.${ext}?auto=compress&cs=tinysrgb&fit=crop&w=${w}&h=${h}`;
var IMG = {
  // Living rooms / sofas (landscape)
  living1: p(6980724),
  living2: p(8089172),
  living3: p(6970059),
  living4: p(6438762),
  living5: p(8135496),
  living6: p(6958126),
  living7: p(6970049),
  living8: p(7214166),
  living9: p(6585599),
  living10: p(6580396),
  // Bedrooms / furniture (landscape)
  bed1: p(2062431),
  bed2: p(2082093),
  bed3: p(2082095),
  bed4: p(7614411),
  bed5: p(7214332),
  bed6: p(6890413),
  bed7: p(12607553),
  bed8: p(6527036),
  bed9: p(6970025),
  bed10: p(9565779),
  // Interior style guide — curated Pexels photography matched to each style.
  styleModern: p(1571460),
  styleMinimal: p(12277220),
  styleScandinavian: p(20390760),
  styleClassic: p(11433090),
  styleNeoclassical: p(12277282),
  styleIndustrial: p(7587827),
  styleBoho: p(20541968),
  styleRustic: p(7746106),
  styleJapandi: p(12285892),
  styleMediterranean: p(4846221),
  styleContemporary: p(6969866),
  styleArtDeco: p(31080809),
  // Decor / objects (square)
  decor1: p(32631105, "jpeg", 900, 900),
  decor2: p(33948970, "png", 900, 900),
  decor3: p(38986381, "jpeg", 900, 900),
  decor4: p(38986380, "jpeg", 900, 900),
  decor5: p(38986382, "jpeg", 900, 900),
  decor6: p(38908537, "jpeg", 900, 900),
  decor7: p(38986383, "jpeg", 900, 900),
  decor8: p(27165068, "jpeg", 900, 900),
  decor9: p(18633243, "jpeg", 900, 900),
  decor10: p(38241046, "jpeg", 900, 900)
};
var roomShots = [
  IMG.living1,
  IMG.living2,
  IMG.living3,
  IMG.living4,
  IMG.living5,
  IMG.living6,
  IMG.living7,
  IMG.living8,
  IMG.living9,
  IMG.living10,
  IMG.bed1,
  IMG.bed2,
  IMG.bed3,
  IMG.bed4,
  IMG.bed5,
  IMG.bed6,
  IMG.bed7,
  IMG.bed8,
  IMG.bed9,
  IMG.bed10
];
var decorShots = [
  IMG.decor1,
  IMG.decor2,
  IMG.decor3,
  IMG.decor4,
  IMG.decor5,
  IMG.decor6,
  IMG.decor7,
  IMG.decor8,
  IMG.decor9,
  IMG.decor10
];

// src/data/products.ts
var COLORS = {
  cream: { name: "\u06A9\u0631\u0645", hex: "#e7dccb" },
  charcoal: { name: "\u0630\u063A\u0627\u0644\u06CC", hex: "#2b2722" },
  terracotta: { name: "\u062A\u0631\u0627\u06A9\u0648\u062A\u0627", hex: "#c2703f" },
  sage: { name: "\u0633\u0628\u0632 \u0645\u0631\u06CC\u0645\u200C\u06AF\u0644\u06CC", hex: "#7c8467" },
  sand: { name: "\u0634\u0646\u06CC", hex: "#cdbfa6" },
  navy: { name: "\u0633\u0631\u0645\u0647\u200C\u0627\u06CC", hex: "#4a6b7c" },
  gold: { name: "\u0637\u0644\u0627\u06CC\u06CC", hex: "#b8915a" },
  white: { name: "\u0633\u0641\u06CC\u062F", hex: "#fbf9f4" },
  plum: { name: "\u0622\u0644\u0628\u0627\u0644\u0648\u06CC\u06CC", hex: "#6b4d5a" }
};
var products2 = [
  {
    id: "p1",
    sku: "SOF-1024",
    slug: "sofa-helia",
    name: "\u06A9\u0627\u0646\u0627\u067E\u0647 \u0647\u0644\u06CC\u0645 \u06F3 \u0646\u0641\u0631\u0647",
    brand: "\u0646\u0648\u0631 \u0645\u0628\u0644\u0645\u0627\u0646",
    storeId: "st1",
    categorySlug: "furniture",
    subCategorySlug: "sofa",
    styleSlugs: ["modern", "scandinavian"],
    price: 485e5,
    oldPrice: 62e6,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.8,
    reviewsCount: 142,
    purchaseCount: 443,
    images: [IMG.living2, IMG.living6, IMG.living7],
    colors: [COLORS.cream, COLORS.charcoal, COLORS.sage],
    materials: ["\u067E\u0627\u0631\u0686\u0647 \u06A9\u062A\u0627\u0646", "\u0686\u0648\u0628 \u0631\u0627\u0634", "\u0641\u0648\u0645 \u0633\u0631\u062F"],
    dimensions: "\u06F2\u06F2\u06F0 \xD7 \u06F9\u06F0 \xD7 \u06F8\u06F5 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u06A9\u0627\u0646\u0627\u067E\u0647\u200C\u06CC \u0647\u0644\u06CC\u0645 \u0628\u0627 \u0637\u0631\u0627\u062D\u06CC \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644 \u0648 \u067E\u0627\u0631\u0686\u0647\u200C\u06CC \u06A9\u062A\u0627\u0646 \u0646\u0631\u0645\u060C \u062A\u0631\u06A9\u06CC\u0628\u06CC \u0627\u0632 \u0631\u0627\u062D\u062A\u06CC \u0648 \u0638\u0631\u0627\u0641\u062A \u0627\u0633\u062A. \u067E\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u0686\u0648\u0628\u06CC \u0631\u0627\u0634 \u06AF\u0631\u0645\u0627 \u0631\u0627 \u0628\u0647 \u0641\u0636\u0627 \u0645\u06CC\u200C\u0622\u0648\u0631\u0646\u062F.",
    specs: [{ label: "\u0646\u0648\u0639", value: "\u06F3 \u0646\u0641\u0631\u0647" }, { label: "\u067E\u0627\u06CC\u0647", value: "\u0686\u0648\u0628 \u0631\u0627\u0634" }, { label: "\u062A\u0636\u0645\u06CC\u0646", value: "\u06F2\u06F4 \u0645\u0627\u0647" }],
    inStock: true,
    stockCount: 8,
    trending: true,
    aiRecommended: true,
    tags: ["\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", "\u0645\u062F\u0631\u0646"]
  },
  {
    id: "p2",
    sku: "SOF-1025",
    slug: "sofa-lumi",
    name: "\u0645\u0628\u0644 \u0631\u0627\u062D\u062A\u06CC \u0644\u0648\u0648\u0645\u06CC",
    brand: "\u0646\u0648\u0631 \u0645\u0628\u0644\u0645\u0627\u0646",
    storeId: "st1",
    categorySlug: "furniture",
    subCategorySlug: "armchair",
    styleSlugs: ["modern", "art-deco"],
    price: 189e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.7,
    reviewsCount: 88,
    purchaseCount: 281,
    images: [IMG.living3, IMG.living9],
    colors: [COLORS.terracotta, COLORS.charcoal],
    materials: ["\u062D\u0631\u06CC\u0631 \u0645\u0635\u0646\u0648\u0639\u06CC", "\u0641\u0644\u0632"],
    dimensions: "\u06F8\u06F5 \xD7 \u06F8\u06F0 \xD7 \u06F9\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0645\u0628\u0644 \u0631\u0627\u062D\u062A\u06CC \u0644\u0648\u0648\u0645\u06CC \u0628\u0627 \u062E\u0637\u0648\u0637 \u0645\u0646\u062D\u0646\u06CC \u0648 \u0631\u0648\u06A9\u0634 \u0645\u062E\u0645\u0644\u060C \u0628\u0631\u0627\u06CC \u06CC\u06A9 \u06AF\u0648\u0634\u0647\u200C\u06CC \u062F\u0646\u062C \u0648 \u0634\u06CC\u06A9 \u062F\u0631 \u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC.",
    specs: [{ label: "\u0646\u0648\u0639", value: "\u062A\u06A9\u200C\u0646\u0641\u0631\u0647" }, { label: "\u067E\u0627\u06CC\u0647", value: "\u0641\u0644\u0632" }],
    inStock: true,
    stockCount: 12,
    trending: true,
    tags: ["\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", "\u0631\u0627\u062D\u062A\u06CC"]
  },
  {
    id: "p3",
    sku: "TBL-2041",
    slug: "coffee-table-oak",
    name: "\u0645\u06CC\u0632 \u062C\u0644\u0648 \u0645\u0628\u0644\u06CC \u0628\u0644\u0648\u0637",
    brand: "\u0622\u0631\u0627 \u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628",
    storeId: "st7",
    categorySlug: "furniture",
    subCategorySlug: "coffee-table",
    styleSlugs: ["scandinavian", "japandi"],
    price: 78e5,
    oldPrice: 95e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.6,
    reviewsCount: 54,
    purchaseCount: 179,
    images: [IMG.living9, IMG.decor7],
    colors: [COLORS.sand, COLORS.charcoal],
    materials: ["\u0686\u0648\u0628 \u0628\u0644\u0648\u0637", "MDF"],
    dimensions: "\u06F1\u06F1\u06F0 \xD7 \u06F6\u06F0 \xD7 \u06F3\u06F8 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0645\u06CC\u0632 \u062C\u0644\u0648 \u0645\u0628\u0644\u06CC \u0628\u0627 \u0633\u0637\u062D \u0686\u0648\u0628 \u0628\u0644\u0648\u0637 \u0637\u0628\u06CC\u0639\u06CC \u0648 \u067E\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u0638\u0631\u06CC\u0641\u060C \u06A9\u0627\u0645\u0644\u0627\u064B \u0645\u0646\u0637\u0628\u0642 \u0628\u0627 \u0633\u0628\u06A9 \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC.",
    specs: [{ label: "\u0645\u062A\u0631\u06CC\u0627\u0644", value: "\u0686\u0648\u0628 \u0628\u0644\u0648\u0637" }],
    inStock: true,
    stockCount: 20,
    isNew: true,
    tags: ["\u0645\u06CC\u0632", "\u0686\u0648\u0628"]
  },
  {
    id: "p4",
    sku: "TBL-2042",
    slug: "dining-set-sara",
    name: "\u0645\u06CC\u0632 \u0648 \u0635\u0646\u062F\u0644\u06CC \u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC \u0633\u0627\u0631\u0627",
    brand: "\u0646\u0648\u0631 \u0645\u0628\u0644\u0645\u0627\u0646",
    storeId: "st1",
    categorySlug: "furniture",
    subCategorySlug: "dining-table",
    styleSlugs: ["modern", "contemporary"],
    price: 63e6,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.9,
    reviewsCount: 73,
    purchaseCount: 236,
    images: [IMG.living9, IMG.living2],
    colors: [COLORS.charcoal, COLORS.sand],
    materials: ["\u0686\u0648\u0628 \u0631\u0627\u0634", "\u067E\u0627\u0631\u0686\u0647"],
    dimensions: "\u0645\u06CC\u0632 \u06F1\u06F8\u06F0 \xD7 \u06F9\u06F0 + \u06F6 \u0635\u0646\u062F\u0644\u06CC",
    description: "\u0633\u062A \u06A9\u0627\u0645\u0644 \u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC \u0634\u0627\u0645\u0644 \u0645\u06CC\u0632 \u0648 \u06F6 \u0635\u0646\u062F\u0644\u06CC\u060C \u0645\u0646\u0627\u0633\u0628 \u062C\u0645\u0639\u200C\u0634\u062F\u0646\u200C\u0647\u0627\u06CC \u062E\u0627\u0646\u0648\u0627\u062F\u06AF\u06CC \u0628\u0627 \u0638\u0627\u0647\u0631\u06CC \u0645\u062F\u0631\u0646.",
    specs: [{ label: "\u0638\u0631\u0641\u06CC\u062A", value: "\u06F6 \u0646\u0641\u0631" }],
    inStock: true,
    stockCount: 5,
    tags: ["\u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC", "\u0633\u062A"]
  },
  {
    id: "p5",
    sku: "CHR-3011",
    slug: "chair-mio",
    name: "\u0635\u0646\u062F\u0644\u06CC \u0645\u0650\u0626\u0648",
    brand: "\u0622\u062A\u0644\u06CC\u0647 \u0646\u0648\u0631",
    storeId: "st10",
    categorySlug: "furniture",
    subCategorySlug: "chair",
    styleSlugs: ["classic", "neoclassical"],
    price: 62e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.5,
    reviewsCount: 41,
    purchaseCount: 140,
    images: [IMG.decor8],
    colors: [COLORS.plum, COLORS.gold],
    materials: ["\u0645\u062E\u0645\u0644", "\u0686\u0648\u0628 \u06AF\u0631\u062F\u0648"],
    description: "\u0635\u0646\u062F\u0644\u06CC \u062A\u06A9\u06CC \u0628\u0627 \u0631\u0648\u06A9\u0634 \u0645\u062E\u0645\u0644 \u0648 \u067E\u0627\u06CC\u0647\u200C\u06CC \u0686\u0648\u0628 \u06AF\u0631\u062F\u0648\u060C \u06CC\u06A9 \u0644\u0645\u0633 \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0648 \u0644\u0648\u06A9\u0633 \u0628\u0631\u0627\u06CC \u0647\u0631 \u0641\u0636\u0627.",
    specs: [{ label: "\u062C\u0646\u0633", value: "\u0645\u062E\u0645\u0644" }],
    inStock: true,
    stockCount: 16,
    tags: ["\u0635\u0646\u062F\u0644\u06CC", "\u06A9\u0644\u0627\u0633\u06CC\u06A9"]
  },
  {
    id: "p6",
    sku: "DEC-4011",
    slug: "vase-ceramic-blue",
    name: "\u06AF\u0644\u062F\u0627\u0646 \u0633\u0631\u0627\u0645\u06CC\u06A9\u06CC \u0644\u0627\u062C\u0648\u0631\u062F\u06CC",
    brand: "\u06A9\u0627\u0633\u0647\u200C\u0628\u0648 \u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647",
    storeId: "st6",
    categorySlug: "decor",
    subCategorySlug: "vase",
    styleSlugs: ["boho", "mediterranean"],
    price: 145e4,
    oldPrice: 21e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.8,
    reviewsCount: 120,
    purchaseCount: 377,
    images: [IMG.decor9, IMG.decor6],
    colors: [COLORS.navy, COLORS.white],
    materials: ["\u0633\u0631\u0627\u0645\u06CC\u06A9 \u062F\u0633\u062A\u200C\u0633\u0627\u0632"],
    dimensions: "\u0627\u0631\u062A\u0641\u0627\u0639 \u06F3\u06F2 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u06AF\u0644\u062F\u0627\u0646 \u0633\u0631\u0627\u0645\u06CC\u06A9\u06CC \u062F\u0633\u062A\u200C\u0633\u0627\u0632 \u0628\u0627 \u06AF\u0644\u200C\u0648\u0644\u0627\u06CC \u0644\u0627\u062C\u0648\u0631\u062F\u06CC\u060C \u0647\u0631 \u0642\u0637\u0639\u0647 \u0645\u0646\u062D\u0635\u0631\u0628\u0647\u200C\u0641\u0631\u062F \u0648 \u0627\u062B\u0631\u06CC \u0627\u0632 \u062F\u0633\u062A \u0647\u0646\u0631\u0645\u0646\u062F.",
    specs: [{ label: "\u0633\u0627\u062E\u062A", value: "\u062F\u0633\u062A\u06CC" }],
    inStock: true,
    stockCount: 40,
    trending: true,
    tags: ["\u06AF\u0644\u062F\u0627\u0646", "\u0633\u0631\u0627\u0645\u06CC\u06A9"]
  },
  {
    id: "p7",
    sku: "DEC-4012",
    slug: "mirror-arch",
    name: "\u0622\u06CC\u0646\u0647 \u0637\u0627\u0642\u06CC \u0628\u0631\u0646\u0632\u06CC",
    brand: "\u0622\u062A\u0644\u06CC\u0647 \u0646\u0648\u0631",
    storeId: "st10",
    categorySlug: "decor",
    subCategorySlug: "mirror",
    styleSlugs: ["modern", "neoclassical"],
    price: 49e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.7,
    reviewsCount: 36,
    purchaseCount: 125,
    images: [IMG.decor8],
    colors: [COLORS.gold, COLORS.charcoal],
    materials: ["\u0641\u0644\u0632 \u0628\u0631\u0646\u0632\u06CC", "\u0622\u06CC\u0646\u0647"],
    dimensions: "\u06F1\u06F6\u06F0 \xD7 \u06F8\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0622\u06CC\u0646\u0647\u200C\u06CC \u0637\u0627\u0642\u06CC \u0628\u0627 \u0642\u0627\u0628 \u0628\u0631\u0646\u0632\u06CC\u060C \u0646\u0642\u0637\u0647\u200C\u06CC \u06A9\u0627\u0646\u0648\u0646\u06CC\u0650 \u0638\u0631\u06CC\u0641 \u0628\u0631\u0627\u06CC \u062F\u06CC\u0648\u0627\u0631 \u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u06CC\u0627 \u0631\u0627\u0647\u0631\u0648.",
    specs: [{ label: "\u0642\u0627\u0628", value: "\u0641\u0644\u0632 \u0628\u0631\u0646\u0632\u06CC" }],
    inStock: true,
    stockCount: 9,
    tags: ["\u0622\u06CC\u0646\u0647", "\u062F\u06CC\u0648\u0627\u0631"]
  },
  {
    id: "p8",
    sku: "ART-5011",
    slug: "wall-art-line",
    name: "\u062A\u0627\u0628\u0644\u0648 \u062E\u0637\u06CC \u0645\u062F\u0631\u0646",
    brand: "\u0686\u0627\u067E\u0627\u0646 \u062F\u06A9\u0648\u0631",
    storeId: "st2",
    categorySlug: "decor",
    subCategorySlug: "wall-art",
    styleSlugs: ["minimal", "modern"],
    price: 28e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.4,
    reviewsCount: 22,
    purchaseCount: 83,
    images: [IMG.decor6],
    colors: [COLORS.charcoal, COLORS.cream],
    materials: ["\u0628\u0648\u0645", "\u0686\u0648\u0628"],
    dimensions: "\u06F9\u06F0 \xD7 \u06F1\u06F2\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u062A\u0627\u0628\u0644\u0648\u06CC \u0627\u0646\u062A\u0632\u0627\u0639\u06CC \u0628\u0627 \u062E\u0637\u0648\u0637 \u0633\u0627\u062F\u0647\u060C \u0628\u0631\u0627\u06CC \u06A9\u0627\u0645\u0644\u200C\u06A9\u0631\u062F\u0646 \u06CC\u06A9 \u062F\u06CC\u0648\u0627\u0631 \u062E\u0627\u0644\u06CC \u0648 \u062E\u0644\u0642 \u062D\u0633 \u0622\u0631\u0627\u0645\u0634.",
    specs: [{ label: "\u0646\u0648\u0639", value: "\u0628\u0648\u0645 \u06A9\u0634\u06CC\u062F\u0647" }],
    inStock: true,
    stockCount: 25,
    tags: ["\u062A\u0627\u0628\u0644\u0648", "\u0647\u0646\u0631"]
  },
  {
    id: "p9",
    sku: "LAMP-552",
    slug: "lamp-wood-minimal",
    name: "\u0686\u0631\u0627\u063A \u0631\u0648\u0645\u06CC\u0632\u06CC \u0686\u0648\u0628\u06CC \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644",
    brand: "\u0644\u0648\u0627\u0645\u06CC\u0646\u0627",
    storeId: "st3",
    categorySlug: "lighting",
    subCategorySlug: "table-lamp",
    styleSlugs: ["japandi", "minimal"],
    price: 39e5,
    oldPrice: 52e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.9,
    reviewsCount: 167,
    purchaseCount: 518,
    images: [IMG.decor3, IMG.decor4, IMG.decor5],
    colors: [COLORS.sand, COLORS.charcoal],
    materials: ["\u0686\u0648\u0628 \u0631\u0627\u0634", "\u06A9\u062A\u0627\u0646"],
    dimensions: "\u0627\u0631\u062A\u0641\u0627\u0639 \u06F4\u06F5 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0686\u0631\u0627\u063A \u0631\u0648\u0645\u06CC\u0632\u06CC \u0628\u0627 \u067E\u0627\u06CC\u0647\u200C\u06CC \u0686\u0648\u0628\u06CC \u0648 \u0634\u06CC\u062F \u06A9\u062A\u0627\u0646\u06CC\u060C \u0646\u0648\u0631\u06CC \u06AF\u0631\u0645 \u0648 \u0622\u0631\u0627\u0645\u0634\u200C\u0628\u062E\u0634 \u0628\u0631\u0627\u06CC \u06AF\u0648\u0634\u0647\u200C\u06CC \u0645\u0637\u0627\u0644\u0639\u0647.",
    specs: [{ label: "\u0646\u0648\u0631", value: "LED \u06AF\u0631\u0645" }, { label: "\u0627\u062A\u0635\u0627\u0644", value: "\u06A9\u0627\u0628\u0644 \u0628\u0631\u0642" }],
    inStock: true,
    stockCount: 30,
    trending: true,
    aiRecommended: true,
    tags: ["\u0646\u0648\u0631", "\u0631\u0648\u0645\u06CC\u0632\u06CC"]
  },
  {
    id: "p10",
    sku: "LGT-6012",
    slug: "floor-lamp-arc",
    name: "\u0622\u0628\u0627\u0698\u0648\u0631 \u0642\u0648\u0633\u06CC \u0644\u0648\u06A9\u0633",
    brand: "\u0644\u0648\u0627\u0645\u06CC\u0646\u0627",
    storeId: "st3",
    categorySlug: "lighting",
    subCategorySlug: "floor-lamp",
    styleSlugs: ["art-deco", "contemporary"],
    price: 89e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.6,
    reviewsCount: 48,
    purchaseCount: 161,
    images: [IMG.decor3],
    colors: [COLORS.gold, COLORS.charcoal],
    materials: ["\u0641\u0644\u0632", "\u0645\u0631\u0645\u0631"],
    dimensions: "\u0627\u0631\u062A\u0641\u0627\u0639 \u06F1\u06F8\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0622\u0628\u0627\u0698\u0648\u0631 \u0642\u0648\u0633\u06CC \u0628\u0627 \u067E\u0627\u06CC\u0647\u200C\u06CC \u0645\u0631\u0645\u0631 \u0648 \u0628\u062F\u0646\u0647\u200C\u06CC \u0641\u0644\u0632\u06CC\u060C \u06CC\u06A9 \u0642\u0637\u0639\u0647\u200C\u06CC \u0645\u062C\u0633\u0645\u0647\u200C\u0648\u0627\u0631 \u06A9\u0647 \u0646\u0648\u0631 \u0631\u0627 \u0631\u0648\u06CC \u0645\u0628\u0644 \u0645\u06CC\u200C\u067E\u0631\u0627\u06A9\u0646\u062F.",
    specs: [{ label: "\u067E\u0627\u06CC\u0647", value: "\u0645\u0631\u0645\u0631" }],
    inStock: true,
    stockCount: 7,
    isNew: true,
    tags: ["\u0622\u0628\u0627\u0698\u0648\u0631", "\u0644\u0648\u06A9\u0633"]
  },
  {
    id: "p11",
    sku: "LGT-6013",
    slug: "ceiling-light-sphere",
    name: "\u0686\u0631\u0627\u063A \u0633\u0642\u0641\u06CC \u06A9\u0631\u0648\u06CC",
    brand: "\u0644\u0648\u0627\u0645\u06CC\u0646\u0627",
    storeId: "st3",
    categorySlug: "lighting",
    subCategorySlug: "ceiling",
    styleSlugs: ["modern", "minimal"],
    price: 54e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.5,
    reviewsCount: 33,
    purchaseCount: 116,
    images: [IMG.living5],
    colors: [COLORS.white, COLORS.gold],
    materials: ["\u0641\u0644\u0632", "\u0634\u06CC\u0631"],
    description: "\u0686\u0631\u0627\u063A \u0633\u0642\u0641\u06CC \u06A9\u0631\u0648\u06CC \u0628\u0627 \u067E\u062E\u0634 \u0646\u0648\u0631 \u0645\u0644\u0627\u06CC\u0645\u060C \u0645\u0646\u0627\u0633\u0628 \u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u0648 \u0631\u0627\u0647\u0631\u0648 \u0628\u0627 \u0633\u0642\u0641 \u06A9\u0648\u062A\u0627\u0647.",
    specs: [{ label: "\u0646\u0648\u0631", value: "\u0645\u0644\u0627\u06CC\u0645" }],
    inStock: true,
    stockCount: 18,
    tags: ["\u0633\u0642\u0641\u06CC", "\u0646\u0648\u0631"]
  },
  {
    id: "p12",
    sku: "RUG-7011",
    slug: "rug-berber",
    name: "\u0642\u0627\u0644\u06CC\u0686\u0647 \u0628\u0631\u0628\u0631\u06CC \u062F\u0633\u062A\u200C\u0628\u0627\u0641\u062A",
    brand: "\u0641\u0631\u0634 \u0633\u0631\u0627",
    storeId: "st4",
    categorySlug: "rugs",
    subCategorySlug: "rug",
    styleSlugs: ["boho", "rustic"],
    price: 98e5,
    oldPrice: 13e6,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.8,
    reviewsCount: 95,
    purchaseCount: 302,
    images: [IMG.decor10, IMG.living3],
    colors: [COLORS.cream, COLORS.terracotta],
    materials: ["\u067E\u0634\u0645", "\u0646\u062E \u0637\u0628\u06CC\u0639\u06CC"],
    dimensions: "\u06F2\u06F0\u06F0 \xD7 \u06F1\u06F5\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0642\u0627\u0644\u06CC\u0686\u0647 \u0628\u0631\u0628\u0631\u06CC \u0628\u0627 \u0627\u0644\u06AF\u0648\u0647\u0627\u06CC \u0647\u0646\u062F\u0633\u06CC \u0648 \u0631\u0646\u06AF\u200C\u0647\u0627\u06CC \u0632\u0645\u06CC\u0646\u06CC\u060C \u06AF\u0631\u0645\u06CC \u0648 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631\u06CC \u0645\u0646\u062D\u0635\u0631\u0628\u0647\u200C\u0641\u0631\u062F \u0628\u0647 \u0641\u0636\u0627 \u0645\u06CC\u200C\u062F\u0647\u062F.",
    specs: [{ label: "\u0628\u0627\u0641\u062A", value: "\u062F\u0633\u062A\u06CC" }, { label: "\u0645\u062A\u0631\u06CC\u0627\u0644", value: "\u067E\u0634\u0645" }],
    inStock: true,
    stockCount: 6,
    trending: true,
    tags: ["\u0642\u0627\u0644\u06CC\u0686\u0647", "\u067E\u0634\u0645"]
  },
  {
    id: "p13",
    sku: "RUG-7012",
    slug: "carpet-modern-geo",
    name: "\u0641\u0631\u0634 \u0645\u062F\u0631\u0646 \u0647\u0646\u062F\u0633\u06CC",
    brand: "\u0641\u0631\u0634 \u0633\u0631\u0627",
    storeId: "st4",
    categorySlug: "rugs",
    subCategorySlug: "carpet",
    styleSlugs: ["modern", "contemporary"],
    price: 145e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.6,
    reviewsCount: 51,
    purchaseCount: 170,
    images: [IMG.living8],
    colors: [COLORS.charcoal, COLORS.cream],
    materials: ["\u067E\u0644\u06CC\u200C\u067E\u0631\u0648\u067E\u06CC\u0644\u0646", "\u0646\u062E \u062D\u0631\u06CC\u0631"],
    dimensions: "\u06F3\u06F0\u06F0 \xD7 \u06F2\u06F0\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0641\u0631\u0634 \u0645\u0627\u0634\u06CC\u0646\u06CC \u0628\u0627 \u0637\u0631\u062D \u0647\u0646\u062F\u0633\u06CC \u0645\u062F\u0631\u0646 \u0648 \u0631\u0646\u06AF\u200C\u0647\u0627\u06CC \u062E\u0646\u062B\u06CC\u060C \u0628\u0631\u0627\u06CC \u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632\u06CC.",
    specs: [{ label: "\u0628\u0627\u0641\u062A", value: "\u0645\u0627\u0634\u06CC\u0646\u06CC" }],
    inStock: true,
    stockCount: 14,
    tags: ["\u0641\u0631\u0634", "\u0645\u062F\u0631\u0646"]
  },
  {
    id: "p14",
    sku: "CUR-8011",
    slug: "curtain-linen",
    name: "\u067E\u0631\u062F\u0647 \u06A9\u062A\u0627\u0646 \u0628\u0644\u0646\u062F",
    brand: "\u0646\u0648\u0646 \u062A\u06A9\u0633\u062A\u0627\u06CC\u0644",
    storeId: "st5",
    categorySlug: "textiles",
    subCategorySlug: "curtain",
    styleSlugs: ["scandinavian", "minimal"],
    price: 32e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.5,
    reviewsCount: 44,
    purchaseCount: 149,
    images: [IMG.living6],
    colors: [COLORS.cream, COLORS.sand, COLORS.sage],
    materials: ["\u06A9\u062A\u0627\u0646", "\u067E\u0646\u0628\u0647"],
    dimensions: "\u0637\u0648\u0644 \u06F2\u06F6\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631 (\u062C\u0641\u062A\u06CC)",
    description: "\u067E\u0631\u062F\u0647\u200C\u06CC \u06A9\u062A\u0627\u0646 \u0628\u0627 \u0631\u06CC\u0632\u0634 \u0637\u0628\u06CC\u0639\u06CC\u060C \u0646\u0648\u0631 \u0631\u0627 \u0646\u0631\u0645 \u0641\u06CC\u0644\u062A\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u062D\u0633 \u0622\u0631\u0627\u0645\u0634 \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC \u0645\u06CC\u200C\u0633\u0627\u0632\u062F.",
    specs: [{ label: "\u0646\u0648\u0639", value: "\u062C\u0641\u062A\u06CC" }],
    inStock: true,
    stockCount: 22,
    isNew: true,
    tags: ["\u067E\u0631\u062F\u0647", "\u06A9\u062A\u0627\u0646"]
  },
  {
    id: "p15",
    sku: "TEX-8012",
    slug: "cushion-set-earth",
    name: "\u0633\u062A \u06A9\u0648\u0633\u0646 \u067E\u0627\u0644\u062A \u062E\u0627\u06A9\u06CC",
    brand: "\u0646\u0648\u0646 \u062A\u06A9\u0633\u062A\u0627\u06CC\u0644",
    storeId: "st5",
    categorySlug: "textiles",
    subCategorySlug: "cushion",
    styleSlugs: ["boho", "rustic"],
    price: 185e4,
    oldPrice: 24e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.7,
    reviewsCount: 130,
    purchaseCount: 407,
    images: [IMG.living3, IMG.living6],
    colors: [COLORS.terracotta, COLORS.sand, COLORS.cream],
    materials: ["\u06A9\u062A\u0627\u0646", "\u0648\u0644\u0648\u0631"],
    dimensions: "\u0633\u062A \u06F4 \u062A\u0627\u06CC\u06CC \u06F4\u06F5\xD7\u06F4\u06F5",
    description: "\u0633\u062A \u0686\u0647\u0627\u0631 \u062A\u0627\u06CC\u06CC \u06A9\u0648\u0633\u0646 \u0628\u0627 \u0628\u0627\u0641\u062A\u200C\u0647\u0627\u06CC \u0645\u062A\u0646\u0648\u0639 \u0648 \u0631\u0646\u06AF\u200C\u0647\u0627\u06CC \u0632\u0645\u06CC\u0646\u06CC\u060C \u0628\u0631\u0627\u06CC \u0644\u0627\u06CC\u0647\u200C\u0644\u0627\u06CC\u0647\u200C\u06A9\u0631\u062F\u0646 \u0645\u0628\u0644.",
    specs: [{ label: "\u062A\u0639\u062F\u0627\u062F", value: "\u06F4 \u0639\u062F\u062F" }],
    inStock: true,
    stockCount: 35,
    trending: true,
    tags: ["\u06A9\u0648\u0633\u0646", "\u0633\u062A"]
  },
  {
    id: "p16",
    sku: "TEX-8013",
    slug: "throw-knit",
    name: "\u067E\u0648\u0634\u0627\u0644\u06CC \u0628\u0627\u0641\u062A\u200C\u062F\u0627\u0631",
    brand: "\u0646\u0648\u0646 \u062A\u06A9\u0633\u062A\u0627\u06CC\u0644",
    storeId: "st5",
    categorySlug: "textiles",
    subCategorySlug: "throw",
    styleSlugs: ["scandinavian", "rustic"],
    price: 12e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.6,
    reviewsCount: 67,
    purchaseCount: 218,
    images: [IMG.living6],
    colors: [COLORS.cream, COLORS.charcoal],
    materials: ["\u0627\u06A9\u0631\u06CC\u0644\u06CC\u06A9", "\u067E\u0634\u0645"],
    description: "\u067E\u0648\u0634\u0627\u0644\u06CC \u0646\u0631\u0645 \u0628\u0627\u0641\u062A\u200C\u062F\u0627\u0631 \u0628\u0631\u0627\u06CC \u0631\u0648\u06CC \u0645\u0628\u0644 \u06CC\u0627 \u062A\u062E\u062A\u060C \u06AF\u0631\u0645\u0627 \u0648 \u0628\u0627\u0641\u062A \u0631\u0627 \u0628\u0647 \u0641\u0636\u0627 \u0627\u0636\u0627\u0641\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    specs: [{ label: "\u0628\u0627\u0641\u062A", value: "\u062F\u0633\u062A\u200C\u0628\u0627\u0641 \u0634\u0628\u06CC\u0647" }],
    inStock: true,
    stockCount: 28,
    tags: ["\u067E\u0648\u0634\u0627\u0644\u06CC", "\u06AF\u0631\u0645"]
  },
  {
    id: "p17",
    sku: "KIT-9011",
    slug: "dinnerware-stone",
    name: "\u0633\u062A \u0638\u0631\u0648\u0641 \u0627\u0633\u062A\u0648\u0646\u200C\u0648\u0631",
    brand: "\u06A9\u0627\u0633\u0647\u200C\u0628\u0648 \u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647",
    storeId: "st6",
    categorySlug: "kitchen",
    subCategorySlug: "dinnerware",
    styleSlugs: ["minimal", "japandi"],
    price: 42e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.8,
    reviewsCount: 156,
    purchaseCount: 485,
    images: [IMG.bed3],
    colors: [COLORS.sand, COLORS.charcoal],
    materials: ["\u0633\u0631\u0627\u0645\u06CC\u06A9 \u0627\u0633\u062A\u0648\u0646\u200C\u0648\u0631"],
    dimensions: "\u0633\u062A \u06F1\u06F2 \u062A\u0627\u06CC\u06CC (\u06F4 \u0646\u0641\u0631\u0647)",
    description: "\u0633\u062A \u0638\u0631\u0648\u0641 \u0627\u0633\u062A\u0648\u0646\u200C\u0648\u0631 \u0628\u0627 \u0631\u0646\u06AF \u0645\u0627\u062A \u0648 \u0637\u0628\u06CC\u0639\u06CC\u060C \u0645\u06CC\u0632 \u0646\u0627\u0647\u0627\u0631 \u0631\u0627 \u0628\u0647 \u06CC\u06A9 \u062A\u062C\u0631\u0628\u0647\u200C\u06CC \u0632\u06CC\u0628\u0627 \u062A\u0628\u062F\u06CC\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    specs: [{ label: "\u062A\u0639\u062F\u0627\u062F", value: "\u06F1\u06F2 \u062A\u06A9\u0647" }],
    inStock: true,
    stockCount: 19,
    trending: true,
    tags: ["\u0638\u0631\u0648\u0641", "\u0633\u062A"]
  },
  {
    id: "p18",
    sku: "KIT-9012",
    slug: "kitchen-organizer-wood",
    name: "\u0646\u0638\u0645\u200C\u062F\u0647\u0646\u062F\u0647 \u0686\u0648\u0628\u06CC \u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647",
    brand: "\u06A9\u0627\u0633\u0647\u200C\u0628\u0648 \u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647",
    storeId: "st6",
    categorySlug: "kitchen",
    subCategorySlug: "organizer",
    styleSlugs: ["scandinavian", "minimal"],
    price: 98e4,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.4,
    reviewsCount: 39,
    purchaseCount: 134,
    images: [IMG.decor7],
    colors: [COLORS.sand],
    materials: ["\u0686\u0648\u0628 \u0628\u0627\u0645\u0628\u0648"],
    description: "\u0646\u0638\u0645\u200C\u062F\u0647\u0646\u062F\u0647\u200C\u06CC \u0628\u0627\u0645\u0628\u0648\u06CC\u06CC \u0628\u0631\u0627\u06CC \u06A9\u0634\u0648 \u0648 \u06A9\u0627\u0628\u06CC\u0646\u062A\u060C \u0633\u0627\u062F\u06AF\u06CC \u0648 \u0646\u0638\u0645 \u0631\u0627 \u0628\u0647 \u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647 \u0645\u06CC\u200C\u0622\u0648\u0631\u062F.",
    specs: [{ label: "\u0645\u062A\u0631\u06CC\u0627\u0644", value: "\u0628\u0627\u0645\u0628\u0648" }],
    inStock: true,
    stockCount: 50,
    tags: ["\u0646\u0638\u0645", "\u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647"]
  },
  {
    id: "p19",
    sku: "BED-1011",
    slug: "bed-nordic",
    name: "\u062A\u062E\u062A \u0646\u0648\u0631\u062F\u06CC\u06A9 \u0686\u0648\u0628\u06CC",
    brand: "\u0622\u0631\u0627 \u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628",
    storeId: "st7",
    categorySlug: "bedroom",
    subCategorySlug: "bed",
    styleSlugs: ["scandinavian", "minimal"],
    price: 225e5,
    oldPrice: 28e6,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.7,
    reviewsCount: 62,
    purchaseCount: 203,
    images: [IMG.bed2, IMG.bed9],
    colors: [COLORS.sand, COLORS.white],
    materials: ["\u0686\u0648\u0628 \u0631\u0627\u0634", "MDF"],
    dimensions: "\u06F1\u06F6\u06F0 \xD7 \u06F2\u06F0\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u062A\u062E\u062A \u0646\u0648\u0631\u062F\u06CC\u06A9 \u0628\u0627 \u067E\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u0686\u0648\u0628\u06CC \u06A9\u0645\u200C\u0631\u0646\u06AF \u0648 \u0647\u062F\u062F\u0628\u0631\u062F \u0633\u0627\u062F\u0647\u060C \u0622\u0631\u0627\u0645\u0634 \u06CC\u06A9 \u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628 \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC\u0627\u06CC\u06CC.",
    specs: [{ label: "\u0633\u0627\u06CC\u0632", value: "\u06F1\u06F6\u06F0" }],
    inStock: true,
    stockCount: 6,
    aiRecommended: true,
    tags: ["\u062A\u062E\u062A", "\u0686\u0648\u0628"]
  },
  {
    id: "p20",
    sku: "BED-1012",
    slug: "nightstand-oak",
    name: "\u0645\u06CC\u0632 \u06A9\u0646\u0627\u0631 \u062A\u062E\u062A \u0628\u0644\u0648\u0637",
    brand: "\u0622\u0631\u0627 \u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628",
    storeId: "st7",
    categorySlug: "bedroom",
    subCategorySlug: "nightstand",
    styleSlugs: ["scandinavian", "japandi"],
    price: 34e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.6,
    reviewsCount: 28,
    purchaseCount: 101,
    images: [IMG.bed3],
    colors: [COLORS.sand, COLORS.charcoal],
    materials: ["\u0686\u0648\u0628 \u0628\u0644\u0648\u0637"],
    dimensions: "\u06F4\u06F5 \xD7 \u06F4\u06F0 \xD7 \u06F5\u06F5 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0645\u06CC\u0632 \u06A9\u0646\u0627\u0631 \u062A\u062E\u062A \u0641\u0634\u0631\u062F\u0647 \u0628\u0627 \u06A9\u0634\u0648\u060C \u062C\u0627 \u0628\u0631\u0627\u06CC \u0686\u0631\u0627\u063A\u060C \u06A9\u062A\u0627\u0628 \u0648 \u0648\u0633\u0627\u06CC\u0644 \u0631\u0648\u0632\u0645\u0631\u0647.",
    specs: [{ label: "\u06A9\u0634\u0648", value: "\u06F1 \u0639\u062F\u062F" }],
    inStock: true,
    stockCount: 24,
    tags: ["\u0645\u06CC\u0632", "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628"]
  },
  {
    id: "p21",
    sku: "BED-1013",
    slug: "bedding-linen-set",
    name: "\u0631\u0648\u062A\u062E\u062A\u06CC \u06A9\u062A\u0627\u0646 \u0633\u0627\u062F\u0647",
    brand: "\u0646\u0648\u0646 \u062A\u06A9\u0633\u062A\u0627\u06CC\u0644",
    storeId: "st5",
    categorySlug: "bedroom",
    subCategorySlug: "bedding",
    styleSlugs: ["minimal", "scandinavian"],
    price: 26e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.5,
    reviewsCount: 71,
    purchaseCount: 230,
    images: [IMG.bed9],
    colors: [COLORS.cream, COLORS.sage, COLORS.charcoal],
    materials: ["\u06A9\u062A\u0627\u0646 \u0634\u0633\u062A\u0647"],
    description: "\u0633\u062A \u0631\u0648\u062A\u062E\u062A\u06CC \u06A9\u062A\u0627\u0646 \u0634\u0633\u062A\u0647\u200C\u0634\u062F\u0647 \u0628\u0627 \u062D\u0633 \u0646\u0631\u0645 \u0648 \u0637\u0628\u06CC\u0639\u06CC\u060C \u0628\u0631\u0627\u06CC \u062E\u0648\u0627\u0628\u06CC \u0631\u0627\u062D\u062A \u0648 \u0638\u0627\u0647\u0631\u06CC \u0634\u06CC\u06A9.",
    specs: [{ label: "\u0646\u062E", value: "\u06A9\u062A\u0627\u0646" }],
    inStock: true,
    stockCount: 33,
    isNew: true,
    tags: ["\u0631\u0648\u062A\u062E\u062A\u06CC", "\u06A9\u062A\u0627\u0646"]
  },
  {
    id: "p22",
    sku: "WRD-1014",
    slug: "wardrobe-slim",
    name: "\u06A9\u0645\u062F \u0628\u0627\u0631\u06CC\u06A9 \u0627\u06CC\u0633\u062A\u0627\u062F\u0647",
    brand: "\u0622\u0631\u0627 \u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628",
    storeId: "st7",
    categorySlug: "bedroom",
    subCategorySlug: "wardrobe",
    styleSlugs: ["modern", "minimal"],
    price: 189e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.4,
    reviewsCount: 19,
    purchaseCount: 74,
    images: [IMG.bed8],
    colors: [COLORS.charcoal, COLORS.sand],
    materials: ["MDF", "\u0641\u0644\u0632"],
    dimensions: "\u06F1\u06F2\u06F0 \xD7 \u06F6\u06F0 \xD7 \u06F2\u06F0\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u06A9\u0645\u062F \u0627\u06CC\u0633\u062A\u0627\u062F\u0647\u200C\u06CC \u0628\u0627\u0631\u06CC\u06A9 \u0628\u0631\u0627\u06CC \u0641\u0636\u0627\u0647\u0627\u06CC \u06A9\u0648\u0686\u06A9\u060C \u0628\u0627 \u062F\u0633\u062A\u06AF\u06CC\u0631\u0647\u200C\u0647\u0627\u06CC \u0645\u062E\u0641\u06CC \u0648 \u0638\u0627\u0647\u0631 \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644.",
    specs: [{ label: "\u0637\u0628\u0642\u0647", value: "\u06F3" }],
    inStock: false,
    stockCount: 0,
    tags: ["\u06A9\u0645\u062F", "\u0645\u06CC\u0646\u06CC\u0645\u0627\u0644"]
  },
  {
    id: "p23",
    sku: "DSK-2011",
    slug: "desk-natural",
    name: "\u0645\u06CC\u0632 \u06A9\u0627\u0631 \u0637\u0628\u06CC\u0639\u06CC",
    brand: "\u0648\u0631\u06A9\u200C\u0646\u0633\u062A",
    storeId: "st8",
    categorySlug: "workspace",
    subCategorySlug: "desk",
    styleSlugs: ["scandinavian", "japandi"],
    price: 67e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.7,
    reviewsCount: 58,
    purchaseCount: 191,
    images: [IMG.decor7, IMG.decor3],
    colors: [COLORS.sand, COLORS.charcoal],
    materials: ["\u0686\u0648\u0628 \u0631\u0627\u0634", "\u0641\u0644\u0632"],
    dimensions: "\u06F1\u06F4\u06F0 \xD7 \u06F7\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0645\u06CC\u0632 \u06A9\u0627\u0631 \u0628\u0627 \u0633\u0637\u062D \u0628\u0632\u0631\u06AF \u0686\u0648\u0628\u06CC \u0648 \u067E\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u0638\u0631\u06CC\u0641\u060C \u0627\u0646\u06AF\u06CC\u0632\u0647 \u0648 \u0646\u0638\u0645 \u0628\u0631\u0627\u06CC \u0631\u0648\u0632\u0647\u0627\u06CC \u06A9\u0627\u0631\u06CC.",
    specs: [{ label: "\u0633\u0637\u062D", value: "\u0686\u0648\u0628 \u0631\u0627\u0634" }],
    inStock: true,
    stockCount: 11,
    aiRecommended: true,
    tags: ["\u0645\u06CC\u0632", "\u06A9\u0627\u0631"]
  },
  {
    id: "p24",
    sku: "CHR-3012",
    slug: "office-chair-ergo",
    name: "\u0635\u0646\u062F\u0644\u06CC \u0627\u062F\u0627\u0631\u06CC \u0627\u0631\u06AF\u0648\u0646\u0648\u0645\u06CC\u06A9",
    brand: "\u0648\u0631\u06A9\u200C\u0646\u0633\u062A",
    storeId: "st8",
    categorySlug: "workspace",
    subCategorySlug: "office-chair",
    styleSlugs: ["modern", "contemporary"],
    price: 89e5,
    oldPrice: 11e6,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.6,
    reviewsCount: 84,
    purchaseCount: 269,
    images: [IMG.decor7],
    colors: [COLORS.charcoal, COLORS.sage],
    materials: ["\u062A\u0648\u0631\u06CC", "\u0641\u0644\u0632", "\u067E\u0644\u0627\u0633\u062A\u06CC\u06A9"],
    description: "\u0635\u0646\u062F\u0644\u06CC \u0627\u062F\u0627\u0631\u06CC \u0628\u0627 \u062A\u06A9\u06CC\u0647\u200C\u06AF\u0627\u0647 \u06A9\u0645\u0631\u06CC \u0648 \u062A\u0646\u0638\u06CC\u0645 \u0627\u0631\u062A\u0641\u0627\u0639\u060C \u0628\u0631\u0627\u06CC \u0633\u0627\u0639\u062A\u200C\u0647\u0627\u06CC \u0637\u0648\u0644\u0627\u0646\u06CC \u067E\u0634\u062A \u0645\u06CC\u0632 \u0628\u062F\u0648\u0646 \u062E\u0633\u062A\u06AF\u06CC.",
    specs: [{ label: "\u062A\u0646\u0638\u06CC\u0645", value: "\u0627\u0631\u062A\u0641\u0627\u0639 + \u06A9\u0645\u0631" }],
    inStock: true,
    stockCount: 13,
    trending: true,
    tags: ["\u0635\u0646\u062F\u0644\u06CC", "\u0627\u062F\u0627\u0631\u06CC"]
  },
  {
    id: "p25",
    sku: "DEC-4013",
    slug: "sculpture-stone",
    name: "\u0645\u062C\u0633\u0645\u0647 \u0633\u0646\u06AF\u06CC \u0627\u0646\u062A\u0632\u0627\u0639\u06CC",
    brand: "\u0622\u062A\u0644\u06CC\u0647 \u0646\u0648\u0631",
    storeId: "st10",
    categorySlug: "decor",
    subCategorySlug: "sculpture",
    styleSlugs: ["minimal", "japandi"],
    price: 54e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.5,
    reviewsCount: 17,
    purchaseCount: 68,
    images: [IMG.decor8],
    colors: [COLORS.sand, COLORS.charcoal],
    materials: ["\u0631\u0632\u06CC\u0646 \u0633\u0646\u06AF\u06CC"],
    dimensions: "\u0627\u0631\u062A\u0641\u0627\u0639 \u06F3\u06F8 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0645\u062C\u0633\u0645\u0647\u200C\u06CC \u0627\u0646\u062A\u0632\u0627\u0639\u06CC \u0628\u0627 \u0641\u0631\u0645 \u0646\u0631\u0645 \u0648 \u0633\u0637\u062D \u0645\u0627\u062A\u060C \u06CC\u06A9 \u0642\u0637\u0639\u0647\u200C\u06CC \u0647\u0646\u0631\u06CC \u0628\u0631\u0627\u06CC \u06A9\u0646\u0633\u0648\u0644 \u06CC\u0627 \u0642\u0641\u0633\u0647.",
    specs: [{ label: "\u0645\u062A\u0631\u06CC\u0627\u0644", value: "\u0631\u0632\u06CC\u0646 \u0633\u0646\u06AF\u06CC" }],
    inStock: true,
    stockCount: 8,
    isNew: true,
    tags: ["\u0645\u062C\u0633\u0645\u0647", "\u0647\u0646\u0631"]
  },
  {
    id: "p26",
    sku: "DEC-4014",
    slug: "candle-trio",
    name: "\u0633\u062A \u0634\u0645\u0639 \u0645\u0639\u0637\u0631 \u0633\u0647\u200C\u062A\u0627\u06CC\u06CC",
    brand: "\u0686\u0627\u067E\u0627\u0646 \u062F\u06A9\u0648\u0631",
    storeId: "st2",
    categorySlug: "decor",
    subCategorySlug: "candle",
    styleSlugs: ["boho", "minimal"],
    price: 89e4,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.6,
    reviewsCount: 49,
    purchaseCount: 164,
    images: [IMG.decor6],
    colors: [COLORS.cream, COLORS.sage, COLORS.terracotta],
    materials: ["\u0645\u0648\u0645 \u0633\u0648\u06CC\u0627", "\u0634\u06CC\u0634\u0647"],
    description: "\u0633\u062A \u0633\u0647 \u0634\u0645\u0639 \u0645\u0639\u0637\u0631 \u0628\u0627 \u0639\u0637\u0631\u0647\u0627\u06CC \u0622\u0631\u0627\u0645\u0634\u200C\u0628\u062E\u0634 \u0648 \u0638\u0631\u0648\u0641 \u0634\u06CC\u0634\u0647\u200C\u0627\u06CC\u060C \u0628\u0631\u0627\u06CC \u0634\u0628\u200C\u0647\u0627\u06CC \u062F\u0646\u062C.",
    specs: [{ label: "\u0639\u0637\u0631", value: "\u0648\u0627\u0646\u06CC\u0644 \u0648 \u0686\u0648\u0628" }],
    inStock: true,
    stockCount: 42,
    tags: ["\u0634\u0645\u0639", "\u0645\u0639\u0637\u0631"]
  },
  {
    id: "p27",
    sku: "OUT-5011",
    slug: "outdoor-lounge-set",
    name: "\u0633\u062A \u0645\u0628\u0644\u0645\u0627\u0646 \u0628\u0627\u0644\u06A9\u0646",
    brand: "\u0628\u0627\u0644\u06A9\u0646\u200C\u06A9\u0648",
    storeId: "st9",
    categorySlug: "outdoor",
    subCategorySlug: "outdoor-furniture",
    styleSlugs: ["modern", "mediterranean"],
    price: 32e6,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.4,
    reviewsCount: 23,
    purchaseCount: 86,
    images: [IMG.living5],
    colors: [COLORS.charcoal, COLORS.sage],
    materials: ["\u062D\u0635\u06CC\u0631", "\u0622\u0644\u0648\u0645\u06CC\u0646\u06CC\u0648\u0645", "\u06A9\u0648\u0633\u0646 \u0636\u062F\u0622\u0628"],
    dimensions: "\u0633\u062A \u06F4 \u0646\u0641\u0631\u0647",
    description: "\u0633\u062A \u0645\u0628\u0644\u0645\u0627\u0646 \u0628\u0627\u0644\u06A9\u0646 \u0628\u0627 \u0645\u062A\u0631\u06CC\u0627\u0644 \u0636\u062F\u0622\u0628 \u0648 \u06A9\u0648\u0633\u0646\u200C\u0647\u0627\u06CC \u0645\u0642\u0627\u0648\u0645\u060C \u0628\u0631\u0627\u06CC \u0644\u062D\u0638\u0627\u062A\u06CC \u0622\u0631\u0627\u0645 \u062F\u0631 \u0641\u0636\u0627\u06CC \u0628\u0627\u0632.",
    specs: [{ label: "\u0645\u0642\u0627\u0648\u0645\u062A", value: "\u0636\u062F\u0622\u0628" }],
    inStock: true,
    stockCount: 4,
    isNew: true,
    tags: ["\u0628\u0627\u0644\u06A9\u0646", "\u0628\u06CC\u0631\u0648\u0646\u06CC"]
  },
  {
    id: "p28",
    sku: "OUT-5012",
    slug: "planter-terracotta",
    name: "\u06AF\u0644\u062F\u0627\u0646 \u062A\u0631\u0627\u06A9\u0648\u062A\u0627\u06CC \u0628\u0632\u0631\u06AF",
    brand: "\u0628\u0627\u0644\u06A9\u0646\u200C\u06A9\u0648",
    storeId: "st9",
    categorySlug: "outdoor",
    subCategorySlug: "planter",
    styleSlugs: ["rustic", "mediterranean"],
    price: 15e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.3,
    reviewsCount: 31,
    purchaseCount: 110,
    images: [IMG.decor10],
    colors: [COLORS.terracotta],
    materials: ["\u062A\u0631\u0627\u06A9\u0648\u062A\u0627"],
    dimensions: "\u0627\u0631\u062A\u0641\u0627\u0639 \u06F5\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u06AF\u0644\u062F\u0627\u0646 \u062A\u0631\u0627\u06A9\u0648\u062A\u0627\u06CC \u0628\u0632\u0631\u06AF \u0628\u0627 \u0631\u0646\u06AF \u06AF\u0631\u0645\u060C \u0628\u0631\u0627\u06CC \u06AF\u06CC\u0627\u0647\u0627\u0646 \u0628\u0632\u0631\u06AF \u062F\u0631 \u062A\u0631\u0627\u0633 \u06CC\u0627 \u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC.",
    specs: [{ label: "\u0645\u062A\u0631\u06CC\u0627\u0644", value: "\u062A\u0631\u0627\u06A9\u0648\u062A\u0627" }],
    inStock: true,
    stockCount: 26,
    tags: ["\u06AF\u0644\u062F\u0627\u0646", "\u062A\u0631\u0627\u0633"]
  },
  {
    id: "p29",
    sku: "SOF-1026",
    slug: "sofa-bed-modular",
    name: "\u06A9\u0627\u0646\u0627\u067E\u0647\u200C\u06CC \u0645\u0627\u0698\u0648\u0644\u0627\u0631 \u062E\u0648\u0627\u0628\u200C\u062F\u0627\u0631",
    brand: "\u0646\u0648\u0631 \u0645\u0628\u0644\u0645\u0627\u0646",
    storeId: "st1",
    categorySlug: "furniture",
    subCategorySlug: "sofa",
    styleSlugs: ["modern", "minimal"],
    price: 56e6,
    oldPrice: 68e6,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.9,
    reviewsCount: 211,
    purchaseCount: 650,
    images: [IMG.living4, IMG.living8],
    colors: [COLORS.cream, COLORS.sage, COLORS.charcoal],
    materials: ["\u067E\u0627\u0631\u0686\u0647", "\u0641\u0648\u0645"],
    dimensions: "\u0645\u0627\u0698\u0648\u0644\u0627\u0631 (\u0642\u0627\u0628\u0644 \u062A\u0648\u0633\u0639\u0647)",
    description: "\u06A9\u0627\u0646\u0627\u067E\u0647\u200C\u06CC \u0645\u0627\u0698\u0648\u0644\u0627\u0631 \u0628\u0627 \u0642\u0627\u0628\u0644\u06CC\u062A \u062A\u0628\u062F\u06CC\u0644 \u0628\u0647 \u062A\u062E\u062A\u060C \u0627\u0646\u0639\u0637\u0627\u0641\u200C\u067E\u0630\u06CC\u0631 \u0628\u0631\u0627\u06CC \u0647\u0631 \u067E\u0644\u0627\u0646 \u0648 \u0647\u0631 \u062A\u0639\u062F\u0627\u062F \u0645\u0647\u0645\u0627\u0646.",
    specs: [{ label: "\u0646\u0648\u0639", value: "\u0645\u0627\u0698\u0648\u0644\u0627\u0631" }, { label: "\u062A\u0628\u062F\u06CC\u0644", value: "\u0628\u0647 \u062A\u062E\u062A" }],
    inStock: true,
    stockCount: 7,
    trending: true,
    aiRecommended: true,
    tags: ["\u06A9\u0627\u0646\u0627\u067E\u0647", "\u0645\u0627\u0698\u0648\u0644\u0627\u0631"]
  },
  {
    id: "p30",
    sku: "SHF-6011",
    slug: "bookshelf-ladder",
    name: "\u0645\u06CC\u0632 \u06A9\u062A\u0627\u0628\u062E\u0627\u0646\u0647\u200C\u0627\u06CC \u0646\u0631\u062F\u0628\u0627\u0646\u06CC",
    brand: "\u0686\u0627\u067E\u0627\u0646 \u062F\u06A9\u0648\u0631",
    storeId: "st2",
    categorySlug: "furniture",
    subCategorySlug: "coffee-table",
    styleSlugs: ["scandinavian", "industrial"],
    price: 46e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.5,
    reviewsCount: 37,
    purchaseCount: 128,
    images: [IMG.decor7],
    colors: [COLORS.charcoal, COLORS.sand],
    materials: ["\u0686\u0648\u0628", "\u0641\u0644\u0632"],
    dimensions: "\u06F1\u06F8\u06F0 \xD7 \u06F8\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0642\u0641\u0633\u0647\u200C\u06CC \u0646\u0631\u062F\u0628\u0627\u0646\u06CC \u0628\u0627 \u0686\u0648\u0628 \u0648 \u0641\u0644\u0632\u060C \u0628\u0631\u0627\u06CC \u0646\u0645\u0627\u06CC\u0634 \u06A9\u062A\u0627\u0628\u060C \u06AF\u0644\u062F\u0627\u0646 \u0648 \u0627\u06A9\u0633\u0633\u0648\u0631\u06CC \u062F\u0631 \u0641\u0636\u0627\u0647\u0627\u06CC \u06A9\u0645\u200C\u062C\u0627.",
    specs: [{ label: "\u0637\u0628\u0642\u0647", value: "\u06F5" }],
    inStock: true,
    stockCount: 17,
    tags: ["\u0642\u0641\u0633\u0647", "\u0646\u0631\u062F\u0628\u0627\u0646\u06CC"]
  },
  {
    id: "p31",
    sku: "LGT-6014",
    slug: "wall-sconce-brass",
    name: "\u0686\u0631\u0627\u063A \u062F\u06CC\u0648\u0627\u0631\u06CC \u0628\u0631\u0646\u062C\u06CC",
    brand: "\u0644\u0648\u0627\u0645\u06CC\u0646\u0627",
    storeId: "st3",
    categorySlug: "lighting",
    subCategorySlug: "wall-lamp",
    styleSlugs: ["classic", "art-deco"],
    price: 24e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.4,
    reviewsCount: 26,
    purchaseCount: 95,
    images: [IMG.decor3],
    colors: [COLORS.gold],
    materials: ["\u0628\u0631\u0646\u062C", "\u0634\u06CC\u0634\u0647"],
    description: "\u0686\u0631\u0627\u063A \u062F\u06CC\u0648\u0627\u0631\u06CC \u0628\u0631\u0646\u062C\u06CC \u0628\u0627 \u0646\u0648\u0631 \u0645\u0644\u0627\u06CC\u0645\u060C \u0628\u0631\u0627\u06CC \u0631\u0627\u0647\u0631\u0648\u060C \u067E\u0644\u0647 \u06CC\u0627 \u06A9\u0646\u0627\u0631 \u0622\u06CC\u0646\u0647.",
    specs: [{ label: "\u062C\u0646\u0633", value: "\u0628\u0631\u0646\u062C" }],
    inStock: true,
    stockCount: 21,
    tags: ["\u062F\u06CC\u0648\u0627\u0631\u06CC", "\u0646\u0648\u0631"]
  },
  {
    id: "p32",
    sku: "TEX-8014",
    slug: "table-runner-jute",
    name: "\u0631\u0648\u0645\u06CC\u0632\u06CC \u0686\u0645\u0646\u06CC \u062F\u0633\u062A\u200C\u0628\u0627\u0641\u062A",
    brand: "\u0646\u0648\u0646 \u062A\u06A9\u0633\u062A\u0627\u06CC\u0644",
    storeId: "st5",
    categorySlug: "textiles",
    subCategorySlug: "table-runner",
    styleSlugs: ["boho", "rustic"],
    price: 76e4,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.5,
    reviewsCount: 42,
    purchaseCount: 143,
    images: [IMG.decor10],
    colors: [COLORS.cream, COLORS.sand],
    materials: ["\u062C\u0648\u062A", "\u067E\u0646\u0628\u0647"],
    dimensions: "\u06F5\u06F0 \xD7 \u06F2\u06F0\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0631\u0648\u0645\u06CC\u0632\u06CC \u062C\u0648\u062A \u062F\u0633\u062A\u200C\u0628\u0627\u0641\u062A \u0628\u0627 \u0628\u0627\u0641\u062A \u0637\u0628\u06CC\u0639\u06CC\u060C \u06AF\u0631\u0645\u0627 \u0648 \u0628\u0627\u0641\u062A \u0631\u0627 \u0631\u0648\u06CC \u0645\u06CC\u0632 \u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC \u0645\u06CC\u200C\u0622\u0648\u0631\u062F.",
    specs: [{ label: "\u0645\u062A\u0631\u06CC\u0627\u0644", value: "\u062C\u0648\u062A" }],
    inStock: true,
    stockCount: 38,
    tags: ["\u0631\u0648\u0645\u06CC\u0632\u06CC", "\u0628\u0627\u0641\u062A"]
  },
  {
    id: "p33",
    sku: "SOF-1027",
    slug: "l-sofa-avan",
    name: "\u0645\u0628\u0644 \u0627\u0644 \xAB\u0622\u0648\u0627\u0646\xBB",
    brand: "\u0646\u0648\u0631 \u0645\u0628\u0644\u0645\u0627\u0646",
    storeId: "st1",
    categorySlug: "furniture",
    subCategorySlug: "sofa",
    styleSlugs: ["modern", "minimal"],
    price: 62e6,
    oldPrice: 75e6,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.8,
    reviewsCount: 96,
    purchaseCount: 305,
    images: [IMG.living4, IMG.living8],
    colors: [COLORS.cream, COLORS.charcoal, COLORS.sage, COLORS.sand],
    materials: ["\u067E\u0627\u0631\u0686\u0647", "\u0641\u0648\u0645 \u0633\u0631\u062F"],
    dimensions: "\u0645\u0628\u0644 \u0627\u0644 \u06F2\u06F6\u06F0 \xD7 \u06F1\u06F8\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0645\u0628\u0644 \u0627\u0644 \u0628\u0627 \u0637\u0631\u0627\u062D\u06CC \u0645\u0627\u0698\u0648\u0644\u0627\u0631 \u0648 \u0646\u0634\u06CC\u0645\u0646 \u06AF\u0633\u062A\u0631\u062F\u0647\u060C \u0628\u0647\u062A\u0631\u06CC\u0646 \u0627\u0646\u062A\u062E\u0627\u0628 \u0628\u0631\u0627\u06CC \u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC\u200C\u0647\u0627\u06CC \u0628\u0632\u0631\u06AF \u0648 \u062E\u0627\u0646\u0648\u0627\u062F\u0647\u200C\u062F\u0648\u0633\u062A.",
    specs: [{ label: "\u0646\u0648\u0639", value: "\u0627\u0644 (L)" }, { label: "\u062A\u0628\u062F\u06CC\u0644", value: "\u0628\u0647 \u062A\u062E\u062A" }],
    inStock: true,
    stockCount: 6,
    trending: true,
    aiRecommended: true,
    tags: ["\u0645\u0628\u0644 \u0627\u0644", "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC"]
  },
  {
    id: "p34",
    sku: "LGT-6015",
    slug: "chandelier-nor",
    name: "\u0644\u0648\u0633\u062A\u0631 \u06A9\u0631\u06CC\u0633\u062A\u0627\u0644\u06CC \xAB\u0646\u064F\u0631\xBB",
    brand: "\u0644\u0648\u0627\u0645\u06CC\u0646\u0627",
    storeId: "st3",
    categorySlug: "lighting",
    subCategorySlug: "ceiling",
    styleSlugs: ["neoclassical", "classic"],
    price: 24e6,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.7,
    reviewsCount: 54,
    purchaseCount: 179,
    images: [IMG.living5, IMG.decor3],
    colors: [COLORS.gold, COLORS.white],
    materials: ["\u06A9\u0631\u06CC\u0633\u062A\u0627\u0644", "\u0641\u0644\u0632 \u0628\u0631\u0646\u062C\u06CC"],
    dimensions: "\u0642\u0637\u0631 \u06F8\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0644\u0648\u0633\u062A\u0631 \u06A9\u0631\u06CC\u0633\u062A\u0627\u0644\u06CC \u0628\u0627 \u0628\u062F\u0646\u0647\u200C\u06CC \u0628\u0631\u0646\u062C\u06CC\u060C \u0646\u0642\u0637\u0647\u200C\u06CC \u06A9\u0627\u0646\u0648\u0646\u06CC \u0634\u06A9\u0648\u0647\u200C\u0622\u0645\u06CC\u0632 \u0628\u0631\u0627\u06CC \u0633\u0642\u0641 \u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u06CC\u0627 \u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC.",
    specs: [{ label: "\u0646\u0648\u0639", value: "\u0644\u0648\u0633\u062A\u0631" }],
    inStock: true,
    stockCount: 7,
    isNew: true,
    tags: ["\u0644\u0648\u0633\u062A\u0631", "\u0633\u0642\u0641\u06CC"]
  },
  {
    id: "p35",
    sku: "TBL-2043",
    slug: "dining-table-sepa",
    name: "\u0645\u06CC\u0632 \u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC \u0686\u0648\u0628 \u0628\u0644\u0648\u0637 \xAB\u0633\u0650\u067E\u0627\xBB",
    brand: "\u0646\u0648\u0631 \u0645\u0628\u0644\u0645\u0627\u0646",
    storeId: "st1",
    categorySlug: "furniture",
    subCategorySlug: "dining-table",
    styleSlugs: ["scandinavian", "modern"],
    price: 185e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.6,
    reviewsCount: 41,
    purchaseCount: 140,
    images: [IMG.living9],
    colors: [COLORS.sand, COLORS.charcoal],
    materials: ["\u0686\u0648\u0628 \u0628\u0644\u0648\u0637", "\u0641\u0644\u0632"],
    dimensions: "\u06F1\u06F8\u06F0 \xD7 \u06F9\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0645\u06CC\u0632 \u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC \u0628\u0627 \u0633\u0637\u062D \u0686\u0648\u0628 \u0628\u0644\u0648\u0637 \u0637\u0628\u06CC\u0639\u06CC \u0648 \u067E\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u0638\u0631\u06CC\u0641\u060C \u062C\u0627\u06CC\u06CC \u0628\u0631\u0627\u06CC \u062F\u0648\u0631\u0647\u0645\u06CC\u200C\u0647\u0627\u06CC \u062E\u0627\u0646\u0648\u0627\u062F\u06AF\u06CC.",
    specs: [{ label: "\u0638\u0631\u0641\u06CC\u062A", value: "\u06F6 \u0646\u0641\u0631" }],
    inStock: true,
    stockCount: 9,
    isNew: true,
    tags: ["\u0645\u06CC\u0632 \u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC", "\u0686\u0648\u0628"]
  },
  {
    id: "p36",
    sku: "LGT-6016",
    slug: "floor-lamp-hila",
    name: "\u0622\u0628\u0627\u0698\u0648\u0631 \u0627\u06CC\u0633\u062A\u0627\u062F\u0647 \u0645\u062F\u0631\u0646 \xAB\u0647\u06CC\u0644\u0627\xBB",
    brand: "\u0644\u0648\u0627\u0645\u06CC\u0646\u0627",
    storeId: "st3",
    categorySlug: "lighting",
    subCategorySlug: "floor-lamp",
    styleSlugs: ["modern", "minimal"],
    price: 67e5,
    oldPrice: 82e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.5,
    reviewsCount: 33,
    purchaseCount: 116,
    images: [IMG.decor3, IMG.decor4],
    colors: [COLORS.charcoal, COLORS.gold, COLORS.sand],
    materials: ["\u0641\u0644\u0632", "\u06A9\u062A\u0627\u0646"],
    dimensions: "\u0627\u0631\u062A\u0641\u0627\u0639 \u06F1\u06F6\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u0622\u0628\u0627\u0698\u0648\u0631 \u0627\u06CC\u0633\u062A\u0627\u062F\u0647 \u0628\u0627 \u062E\u0637\u0648\u0637 \u0633\u0627\u062F\u0647 \u0648 \u0646\u0648\u0631 \u06AF\u0631\u0645\u060C \u0628\u0631\u0627\u06CC \u0631\u0648\u0634\u0646\u200C\u06A9\u0631\u062F\u0646 \u06AF\u0648\u0634\u0647\u200C\u0627\u06CC \u0627\u0632 \u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u06CC\u0627 \u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628.",
    specs: [{ label: "\u0646\u0648\u0639", value: "\u0622\u0628\u0627\u0698\u0648\u0631" }],
    inStock: true,
    stockCount: 14,
    tags: ["\u0622\u0628\u0627\u0698\u0648\u0631", "\u0646\u0648\u0631"]
  },
  {
    id: "p37",
    sku: "LGT-6017",
    slug: "wall-sconce-zar",
    name: "\u062F\u06CC\u0648\u0627\u0631\u06A9\u0648\u0628 \u0628\u0631\u0646\u062C\u06CC \xAB\u0632\u064E\u0631\xBB",
    brand: "\u0644\u0648\u0627\u0645\u06CC\u0646\u0627",
    storeId: "st3",
    categorySlug: "lighting",
    subCategorySlug: "wall-lamp",
    styleSlugs: ["neoclassical", "art-deco"],
    price: 29e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.4,
    reviewsCount: 22,
    purchaseCount: 83,
    images: [IMG.decor3],
    colors: [COLORS.gold],
    materials: ["\u0628\u0631\u0646\u062C", "\u0634\u06CC\u0634\u0647"],
    description: "\u062F\u06CC\u0648\u0627\u0631\u06A9\u0648\u0628 \u0628\u0631\u0646\u062C\u06CC \u0628\u0627 \u0646\u0648\u0631 \u0645\u0644\u0627\u06CC\u0645\u060C \u0628\u0631\u0627\u06CC \u0631\u0627\u0647\u0631\u0648\u060C \u067E\u0644\u0647 \u06CC\u0627 \u06A9\u0646\u0627\u0631 \u0622\u06CC\u0646\u0647.",
    specs: [{ label: "\u0646\u0648\u0639", value: "\u062F\u06CC\u0648\u0627\u0631\u06A9\u0648\u0628" }],
    inStock: true,
    stockCount: 30,
    tags: ["\u062F\u06CC\u0648\u0627\u0631\u06A9\u0648\u0628", "\u0646\u0648\u0631"]
  },
  {
    id: "p38",
    sku: "SOF-1028",
    slug: "pouf-narm",
    name: "\u067E\u0648\u0641 \u0645\u062E\u0645\u0644\u06CC \xAB\u0646\u064E\u0631\u0645\xBB",
    brand: "\u0646\u0648\u0646 \u062A\u06A9\u0633\u062A\u0627\u06CC\u0644",
    storeId: "st5",
    categorySlug: "furniture",
    subCategorySlug: "armchair",
    styleSlugs: ["boho", "modern"],
    price: 24e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.3,
    reviewsCount: 18,
    purchaseCount: 71,
    images: [IMG.living3],
    colors: [COLORS.terracotta, COLORS.sage, COLORS.cream, COLORS.plum],
    materials: ["\u0645\u062E\u0645\u0644", "\u0641\u0648\u0645"],
    dimensions: "\u0642\u0637\u0631 \u06F4\u06F5 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u067E\u0648\u0641 \u0645\u062E\u0645\u0644\u06CC \u0633\u0628\u06A9 \u0628\u0631\u0627\u06CC \u0646\u0634\u0633\u062A\u0646 \u06CC\u0627 \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u0645\u06CC\u0632 \u0639\u0631\u0641\u06CC\u060C \u06CC\u06A9 \u0644\u0645\u0633 \u0631\u0646\u06AF\u06CC\u0646 \u0648 \u0631\u0627\u062D\u062A \u0628\u0647 \u0641\u0636\u0627.",
    specs: [{ label: "\u0646\u0648\u0639", value: "\u067E\u0648\u0641" }],
    inStock: true,
    stockCount: 25,
    isNew: true,
    tags: ["\u067E\u0648\u0641", "\u0631\u0627\u062D\u062A\u06CC"]
  },
  {
    id: "p39",
    sku: "SHF-6012",
    slug: "console-line",
    name: "\u06A9\u0646\u0633\u0648\u0644 \u0686\u0648\u0628\u06CC \xAB\u0644\u0627\u06CC\u0646\xBB",
    brand: "\u0622\u0631\u0627 \u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628",
    storeId: "st7",
    categorySlug: "furniture",
    subCategorySlug: "coffee-table",
    styleSlugs: ["minimal", "scandinavian"],
    price: 89e5,
    currency: "\u062A\u0648\u0645\u0627\u0646",
    rating: 4.5,
    reviewsCount: 27,
    purchaseCount: 98,
    images: [IMG.living9, IMG.decor7],
    colors: [COLORS.charcoal, COLORS.sand],
    materials: ["\u0686\u0648\u0628", "\u0641\u0644\u0632"],
    dimensions: "\u06F1\u06F2\u06F0 \xD7 \u06F3\u06F5 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631",
    description: "\u06A9\u0646\u0633\u0648\u0644 \u0628\u0627\u0631\u06CC\u06A9 \u0628\u0631\u0627\u06CC \u0631\u0627\u0647\u0631\u0648 \u06CC\u0627 \u067E\u0634\u062A \u0645\u0628\u0644\u060C \u0628\u0627 \u06A9\u0634\u0648 \u0628\u0631\u0627\u06CC \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0648 \u0633\u0637\u062D\u06CC \u0628\u0631\u0627\u06CC \u062F\u06A9\u0648\u0631.",
    specs: [{ label: "\u06A9\u0634\u0648", value: "\u06F2 \u0639\u062F\u062F" }],
    inStock: true,
    stockCount: 12,
    tags: ["\u06A9\u0646\u0633\u0648\u0644", "\u0631\u0627\u0647\u0631\u0648"]
  }
];
var trendingProducts = products2.filter((p2) => p2.trending);
var aiRecommendedProducts = products2.filter((p2) => p2.aiRecommended);
var newProducts = products2.filter((p2) => p2.isNew);

// src/data/stores.ts
var stores = [
  {
    id: "st1",
    slug: "noor-mobl",
    name: "\u0646\u0648\u0631 \u0645\u0628\u0644\u0645\u0627\u0646",
    logo: "\u0646",
    logoColor: "#c2703f",
    cover: IMG.living2,
    description: "\u0637\u0631\u0627\u062D\u06CC \u0648 \u062A\u0648\u0644\u06CC\u062F \u0645\u0628\u0644\u0645\u0627\u0646 \u0645\u062F\u0631\u0646 \u0628\u0627 \u0645\u062A\u0631\u06CC\u0627\u0644 \u062F\u0631\u062C\u0647 \u06CC\u06A9 \u0648 \u06A9\u0627\u0631\u06AF\u0627\u0647 \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u062F\u0631 \u062A\u0647\u0631\u0627\u0646.",
    rating: 4.8,
    reviewsCount: 1240,
    productCount: 86,
    city: "\u062A\u0647\u0631\u0627\u0646",
    verified: true,
    trending: true,
    isNew: false,
    categorySlugs: ["furniture"],
    salesCount: 3840,
    followersCount: 5210,
    sinceYear: 1398,
    responseTime: "\u0632\u06CC\u0631 \u06F2 \u0633\u0627\u0639\u062A",
    badges: ["\u067E\u0631\u0641\u0631\u0648\u0634", "\u0627\u0631\u0633\u0627\u0644 \u0633\u0631\u06CC\u0639", "\u0636\u0645\u0627\u0646\u062A \u06F2\u06F4 \u0645\u0627\u0647\u0647"],
    shippingPolicy: "\u0627\u0631\u0633\u0627\u0644 \u0628\u0647 \u0633\u0631\u0627\u0633\u0631 \u06A9\u0634\u0648\u0631 \u0637\u06CC \u06F3 \u062A\u0627 \u06F7 \u0631\u0648\u0632 \u06A9\u0627\u0631\u06CC\u061B \u0633\u0641\u0627\u0631\u0634\u200C\u0647\u0627\u06CC \u0628\u0627\u0644\u0627\u06CC \u06F5 \u0645\u06CC\u0644\u06CC\u0648\u0646 \u062A\u0648\u0645\u0627\u0646 \u0627\u0631\u0633\u0627\u0644 \u0631\u0627\u06CC\u06AF\u0627\u0646 \u062F\u0627\u0631\u0646\u062F.",
    returnPolicy: "\u06F7 \u0631\u0648\u0632 \u0628\u0627\u0632\u06AF\u0634\u062A \u0628\u062F\u0648\u0646 \u0642\u06CC\u062F \u0648 \u0634\u0631\u0637 \u062F\u0631 \u0635\u0648\u0631\u062A \u0633\u0627\u0644\u0645 \u0628\u0648\u062F\u0646 \u06A9\u0627\u0644\u0627 \u0648 \u0628\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0627\u0635\u0644\u06CC."
  },
  {
    id: "st2",
    slug: "chapan-decor",
    name: "\u0686\u0627\u067E\u0627\u0646 \u062F\u06A9\u0648\u0631",
    logo: "\u0686",
    logoColor: "#7c8467",
    cover: IMG.decor6,
    description: "\u0627\u06A9\u0633\u0633\u0648\u0631\u06CC \u0648 \u062F\u06A9\u0648\u0631\u0627\u0633\u06CC\u0648\u0646 \u0627\u0644\u0647\u0627\u0645\u200C\u06AF\u0631\u0641\u062A\u0647 \u0627\u0632 \u0633\u0628\u06A9 \u0698\u0627\u067E\u0646\u06CC \u0648 \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644.",
    rating: 4.7,
    reviewsCount: 632,
    productCount: 54,
    city: "\u0627\u0635\u0641\u0647\u0627\u0646",
    verified: true,
    trending: false,
    isNew: true,
    categorySlugs: ["decor"],
    salesCount: 1180,
    followersCount: 2140,
    sinceYear: 1401,
    responseTime: "\u0632\u06CC\u0631 \u06F6 \u0633\u0627\u0639\u062A",
    badges: ["\u0627\u0631\u0633\u0627\u0644 \u0633\u0631\u06CC\u0639", "\u0628\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0627\u0645\u0646"],
    shippingPolicy: "\u0627\u0631\u0633\u0627\u0644 \u0628\u0627 \u0628\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0636\u0631\u0628\u0647\u200C\u06AF\u06CC\u0631 \u0637\u06CC \u06F2 \u062A\u0627 \u06F5 \u0631\u0648\u0632 \u06A9\u0627\u0631\u06CC\u061B \u0627\u0631\u0633\u0627\u0644 \u0631\u0627\u06CC\u06AF\u0627\u0646 \u0627\u0632 \u06F2 \u0645\u06CC\u0644\u06CC\u0648\u0646 \u062A\u0648\u0645\u0627\u0646.",
    returnPolicy: "\u06F7 \u0631\u0648\u0632 \u0628\u0627\u0632\u06AF\u0634\u062A \u0628\u0631\u0627\u06CC \u06A9\u0627\u0644\u0627\u0647\u0627\u06CC \u0633\u0627\u0644\u0645 \u0648 \u0627\u0633\u062A\u0641\u0627\u062F\u0647\u200C\u0646\u0634\u062F\u0647."
  },
  {
    id: "st3",
    slug: "lumina-light",
    name: "\u0644\u0648\u0627\u0645\u06CC\u0646\u0627",
    logo: "\u0644",
    logoColor: "#b8915a",
    cover: IMG.decor3,
    description: "\u0646\u0648\u0631\u067E\u0631\u062F\u0627\u0632\u06CC \u062F\u06A9\u0648\u0631\u0627\u062A\u06CC\u0648 \u0648 \u0686\u0631\u0627\u063A\u200C\u0647\u0627\u06CC \u0637\u0631\u0627\u062D\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u062C\u0627\u062F \u062D\u0633 \u0648 \u062D\u0627\u0644 \u062F\u0631 \u0641\u0636\u0627.",
    rating: 4.9,
    reviewsCount: 988,
    productCount: 73,
    city: "\u062A\u0647\u0631\u0627\u0646",
    verified: true,
    trending: true,
    isNew: false,
    categorySlugs: ["lighting"],
    salesCount: 2960,
    followersCount: 3980,
    sinceYear: 1397,
    responseTime: "\u0632\u06CC\u0631 \u06F3 \u0633\u0627\u0639\u062A",
    badges: ["\u067E\u0631\u0641\u0631\u0648\u0634", "\u06AF\u0627\u0631\u0627\u0646\u062A\u06CC \u0627\u0635\u0627\u0644\u062A"],
    shippingPolicy: "\u0627\u0631\u0633\u0627\u0644 \u0637\u06CC \u06F1 \u062A\u0627 \u06F3 \u0631\u0648\u0632 \u06A9\u0627\u0631\u06CC\u061B \u0644\u0648\u0627\u0632\u0645 \u0631\u0648\u0634\u0646\u0627\u06CC\u06CC \u0628\u0627 \u0628\u06CC\u0645\u0647 \u062D\u0645\u0644 \u0627\u0631\u0633\u0627\u0644 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.",
    returnPolicy: "\u06F7 \u0631\u0648\u0632 \u0628\u0627\u0632\u06AF\u0634\u062A \u0648 \u06F1\u06F8 \u0645\u0627\u0647 \u06AF\u0627\u0631\u0627\u0646\u062A\u06CC \u0641\u0646\u06CC \u0631\u0648\u06CC \u0645\u062D\u0635\u0648\u0644\u0627\u062A \u0628\u0631\u0642\u06CC."
  },
  {
    id: "st4",
    slug: "farsh-sara",
    name: "\u0641\u0631\u0634 \u0633\u0631\u0627",
    logo: "\u0641",
    logoColor: "#a85a2f",
    cover: IMG.decor10,
    description: "\u0641\u0631\u0634 \u0648 \u0642\u0627\u0644\u06CC\u0686\u0647 \u062F\u0633\u062A\u0628\u0627\u0641\u062A \u0648 \u0645\u0627\u0634\u06CC\u0646\u06CC \u0628\u0627 \u0627\u0644\u06AF\u0648\u0647\u0627\u06CC \u0633\u0646\u062A\u06CC \u0648 \u0645\u062F\u0631\u0646.",
    rating: 4.6,
    reviewsCount: 421,
    productCount: 110,
    city: "\u06A9\u0627\u0634\u0627\u0646",
    verified: true,
    trending: false,
    isNew: false,
    categorySlugs: ["rugs"],
    salesCount: 1720,
    followersCount: 2350,
    sinceYear: 1395,
    responseTime: "\u0632\u06CC\u0631 \u06F1\u06F2 \u0633\u0627\u0639\u062A",
    badges: ["\u062A\u0648\u0644\u06CC\u062F \u0645\u0633\u062A\u0642\u06CC\u0645", "\u0627\u0635\u0627\u0644\u062A \u06A9\u0627\u0644\u0627"],
    shippingPolicy: "\u0627\u0631\u0633\u0627\u0644 \u0627\u0632 \u06A9\u0627\u0634\u0627\u0646 \u0637\u06CC \u06F2 \u062A\u0627 \u06F5 \u0631\u0648\u0632 \u06A9\u0627\u0631\u06CC\u061B \u0627\u0645\u06A9\u0627\u0646 \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0645\u0631\u0633\u0648\u0644\u0647 \u0647\u0646\u06AF\u0627\u0645 \u062A\u062D\u0648\u06CC\u0644.",
    returnPolicy: "\u06F7 \u0631\u0648\u0632 \u0628\u0627\u0632\u06AF\u0634\u062A \u0628\u0631\u0627\u06CC \u0641\u0631\u0634\u200C\u0647\u0627\u06CC \u0645\u0627\u0634\u06CC\u0646\u06CC \u0648 \u062F\u0633\u062A\u0628\u0627\u0641\u062A \u0628\u0627 \u0628\u0631\u0686\u0633\u0628 \u0633\u0627\u0644\u0645."
  },
  {
    id: "st5",
    slug: "noon-textile",
    name: "\u0646\u0648\u0646 \u062A\u06A9\u0633\u062A\u0627\u06CC\u0644",
    logo: "\u0646",
    logoColor: "#6b4d5a",
    cover: IMG.living6,
    description: "\u0645\u0646\u0633\u0648\u062C\u0627\u062A \u062E\u0627\u0646\u06AF\u06CC\u060C \u06A9\u0648\u0633\u0646 \u0648 \u067E\u0631\u062F\u0647 \u0628\u0627 \u0628\u0627\u0641\u062A\u200C\u0647\u0627\u06CC \u0646\u0631\u0645 \u0648 \u0631\u0646\u06AF\u200C\u0647\u0627\u06CC \u062F\u0644\u0646\u0634\u06CC\u0646.",
    rating: 4.5,
    reviewsCount: 310,
    productCount: 48,
    city: "\u06CC\u0632\u062F",
    verified: false,
    trending: false,
    isNew: true,
    categorySlugs: ["textiles"],
    salesCount: 640,
    followersCount: 780,
    sinceYear: 1402,
    responseTime: "\u0632\u06CC\u0631 \u06F2\u06F4 \u0633\u0627\u0639\u062A",
    badges: ["\u062A\u0627\u0632\u0647\u200C\u0648\u0627\u0631\u062F"],
    shippingPolicy: "\u0627\u0631\u0633\u0627\u0644 \u0637\u06CC \u06F3 \u062A\u0627 \u06F6 \u0631\u0648\u0632 \u06A9\u0627\u0631\u06CC \u0627\u0632 \u06CC\u0632\u062F.",
    returnPolicy: "\u06F7 \u0631\u0648\u0632 \u0628\u0627\u0632\u06AF\u0634\u062A \u0628\u0631\u0627\u06CC \u0645\u0646\u0633\u0648\u062C\u0627\u062A \u0627\u0633\u062A\u0641\u0627\u062F\u0647\u200C\u0646\u0634\u062F\u0647."
  },
  {
    id: "st6",
    slug: "kasebo-kitchen",
    name: "\u06A9\u0627\u0633\u0647\u200C\u0628\u0648 \u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647",
    logo: "\u06A9",
    logoColor: "#5b7a52",
    cover: IMG.bed3,
    description: "\u0638\u0631\u0648\u0641 \u0633\u0631\u0627\u0645\u06CC\u06A9 \u0648 \u0627\u06A9\u0633\u0633\u0648\u0631\u06CC \u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647 \u0628\u0627 \u0637\u0631\u0627\u062D\u06CC \u0633\u0627\u062F\u0647 \u0648 \u06A9\u0627\u0631\u0628\u0631\u062F\u06CC.",
    rating: 4.8,
    reviewsCount: 540,
    productCount: 92,
    city: "\u0644\u0627\u0644\u062C\u06CC\u0646",
    verified: true,
    trending: true,
    isNew: false,
    categorySlugs: ["kitchen"],
    salesCount: 2050,
    followersCount: 2890,
    sinceYear: 1399,
    responseTime: "\u0632\u06CC\u0631 \u06F4 \u0633\u0627\u0639\u062A",
    badges: ["\u067E\u0631\u0641\u0631\u0648\u0634", "\u062F\u0633\u062A\u200C\u0633\u0627\u0632"],
    shippingPolicy: "\u0627\u0631\u0633\u0627\u0644 \u0633\u0631\u0627\u0645\u06CC\u06A9 \u0628\u0627 \u0628\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0648\u06CC\u0698\u0647 \u0637\u06CC \u06F2 \u062A\u0627 \u06F5 \u0631\u0648\u0632 \u06A9\u0627\u0631\u06CC.",
    returnPolicy: "\u06F7 \u0631\u0648\u0632 \u0628\u0627\u0632\u06AF\u0634\u062A\u061B \u062F\u0631 \u0635\u0648\u0631\u062A \u0634\u06A9\u0633\u062A\u06AF\u06CC \u062F\u0631 \u062D\u0645\u0644\u060C \u062A\u0639\u0648\u06CC\u0636 \u0631\u0627\u06CC\u06AF\u0627\u0646."
  },
  {
    id: "st7",
    slug: "ara-bedroom",
    name: "\u0622\u0631\u0627 \u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628",
    logo: "\u0622",
    logoColor: "#4a6b7c",
    cover: IMG.bed2,
    description: "\u062A\u062E\u062A\u060C \u06A9\u0645\u062F \u0648 \u0645\u0628\u0644\u0645\u0627\u0646 \u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628 \u0628\u0627 \u0637\u0631\u0627\u062D\u06CC \u0622\u0631\u0627\u0645\u0634\u200C\u0628\u062E\u0634.",
    rating: 4.7,
    reviewsCount: 287,
    productCount: 61,
    city: "\u062A\u0647\u0631\u0627\u0646",
    verified: true,
    trending: false,
    isNew: false,
    categorySlugs: ["bedroom", "furniture"],
    salesCount: 1330,
    followersCount: 1760,
    sinceYear: 1400,
    responseTime: "\u0632\u06CC\u0631 \u06F5 \u0633\u0627\u0639\u062A",
    badges: ["\u0627\u0631\u0633\u0627\u0644 \u0648 \u0646\u0635\u0628 \u0631\u0627\u06CC\u06AF\u0627\u0646"],
    shippingPolicy: "\u0627\u0631\u0633\u0627\u0644 \u0648 \u0646\u0635\u0628 \u0631\u0627\u06CC\u06AF\u0627\u0646 \u062F\u0631 \u062A\u0647\u0631\u0627\u0646\u061B \u0634\u0647\u0631\u0633\u062A\u0627\u0646\u200C\u0647\u0627 \u0637\u06CC \u06F4 \u062A\u0627 \u06F8 \u0631\u0648\u0632 \u06A9\u0627\u0631\u06CC.",
    returnPolicy: "\u06F7 \u0631\u0648\u0632 \u0628\u0627\u0632\u06AF\u0634\u062A \u0628\u0631\u0627\u06CC \u0645\u0628\u0644\u0645\u0627\u0646 \u0648 \u062A\u062E\u062A\u200C\u0647\u0627\u06CC \u0627\u0633\u062A\u0641\u0627\u062F\u0647\u200C\u0646\u0634\u062F\u0647."
  },
  {
    id: "st8",
    slug: "work-nest",
    name: "\u0648\u0631\u06A9\u200C\u0646\u0633\u062A",
    logo: "\u0648",
    logoColor: "#2b2722",
    cover: IMG.decor7,
    description: "\u0645\u0628\u0644\u0645\u0627\u0646 \u0648 \u0627\u0628\u0632\u0627\u0631 \u0641\u0636\u0627\u06CC \u06A9\u0627\u0631 \u0628\u0631\u0627\u06CC \u062A\u0645\u0631\u06A9\u0632 \u0648 \u0628\u0647\u0631\u0647\u200C\u0648\u0631\u06CC.",
    rating: 4.6,
    reviewsCount: 198,
    productCount: 39,
    city: "\u062A\u0647\u0631\u0627\u0646",
    verified: false,
    trending: false,
    isNew: true,
    categorySlugs: ["workspace"],
    salesCount: 380,
    followersCount: 520,
    sinceYear: 1402,
    responseTime: "\u0632\u06CC\u0631 \u06F2\u06F4 \u0633\u0627\u0639\u062A",
    badges: ["\u062A\u0627\u0632\u0647\u200C\u0648\u0627\u0631\u062F"],
    shippingPolicy: "\u0627\u0631\u0633\u0627\u0644 \u0637\u06CC \u06F2 \u062A\u0627 \u06F5 \u0631\u0648\u0632 \u06A9\u0627\u0631\u06CC.",
    returnPolicy: "\u06F7 \u0631\u0648\u0632 \u0628\u0627\u0632\u06AF\u0634\u062A \u0628\u0627 \u0628\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0633\u0627\u0644\u0645."
  },
  {
    id: "st9",
    slug: "balkon-co",
    name: "\u0628\u0627\u0644\u06A9\u0646\u200C\u06A9\u0648",
    logo: "\u0628",
    logoColor: "#7c8467",
    cover: IMG.living5,
    description: "\u0645\u0628\u0644\u0645\u0627\u0646 \u0648 \u062F\u06A9\u0648\u0631 \u0641\u0636\u0627\u06CC \u0628\u0627\u0632 \u0628\u0631\u0627\u06CC \u0628\u0627\u0644\u06A9\u0646\u060C \u062A\u0631\u0627\u0633 \u0648 \u062D\u06CC\u0627\u0637.",
    rating: 4.4,
    reviewsCount: 156,
    productCount: 44,
    city: "\u0634\u0645\u0627\u0644",
    verified: false,
    trending: false,
    isNew: false,
    categorySlugs: ["outdoor"],
    salesCount: 410,
    followersCount: 590,
    sinceYear: 1401,
    responseTime: "\u0632\u06CC\u0631 \u06F2\u06F4 \u0633\u0627\u0639\u062A",
    badges: ["\u0641\u0636\u0627\u06CC \u0628\u0627\u0632"],
    shippingPolicy: "\u0627\u0631\u0633\u0627\u0644 \u0645\u0628\u0644\u0645\u0627\u0646 \u0641\u0636\u0627\u06CC \u0628\u0627\u0632 \u0637\u06CC \u06F4 \u062A\u0627 \u06F8 \u0631\u0648\u0632 \u06A9\u0627\u0631\u06CC.",
    returnPolicy: "\u06F7 \u0631\u0648\u0632 \u0628\u0627\u0632\u06AF\u0634\u062A \u0628\u0631\u0627\u06CC \u06A9\u0627\u0644\u0627\u0647\u0627\u06CC \u0633\u0627\u0644\u0645."
  },
  {
    id: "st10",
    slug: "atelier-noor",
    name: "\u0622\u062A\u0644\u06CC\u0647 \u0646\u0648\u0631",
    logo: "\u0622",
    logoColor: "#b8915a",
    cover: IMG.decor8,
    description: "\u06AF\u0627\u0644\u0631\u06CC \u0645\u062D\u0635\u0648\u0644\u0627\u062A \u0644\u0648\u06A9\u0633 \u0648 \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0628\u0631\u0627\u06CC \u062E\u0627\u0646\u0647\u200C\u0647\u0627\u06CC\u06CC \u0628\u0627 \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F \u0628\u0627\u0644\u0627.",
    rating: 4.9,
    reviewsCount: 712,
    productCount: 67,
    city: "\u062A\u0647\u0631\u0627\u0646",
    verified: true,
    trending: true,
    isNew: false,
    categorySlugs: ["decor", "furniture", "lighting"],
    salesCount: 3220,
    followersCount: 4650,
    sinceYear: 1396,
    responseTime: "\u0632\u06CC\u0631 \u06F2 \u0633\u0627\u0639\u062A",
    badges: ["\u0644\u0648\u06A9\u0633", "\u0636\u0645\u0627\u0646\u062A \u0627\u0635\u0627\u0644\u062A"],
    shippingPolicy: "\u0627\u0631\u0633\u0627\u0644 \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u0648 \u0628\u06CC\u0645\u0647\u200C\u0634\u062F\u0647 \u0637\u06CC \u06F3 \u062A\u0627 \u06F6 \u0631\u0648\u0632 \u06A9\u0627\u0631\u06CC\u061B \u0627\u0631\u0633\u0627\u0644 \u0631\u0627\u06CC\u06AF\u0627\u0646 \u0633\u0641\u0627\u0631\u0634\u200C\u0647\u0627\u06CC \u0628\u0627\u0644\u0627\u06CC \u06F5 \u0645\u06CC\u0644\u06CC\u0648\u0646 \u062A\u0648\u0645\u0627\u0646.",
    returnPolicy: "\u06F7 \u0631\u0648\u0632 \u0628\u0627\u0632\u06AF\u0634\u062A \u0648 \u0636\u0645\u0627\u0646\u062A \u0627\u0635\u0627\u0644\u062A \u06A9\u0627\u0644\u0627\u0647\u0627\u06CC \u0644\u0648\u06A9\u0633."
  }
];
var collections2 = [
  { id: "co1", slug: "warm-living", title: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u06AF\u0631\u0645", subtitle: "\u067E\u0627\u0644\u062A \u062E\u0627\u06A9\u06CC \u0648 \u0646\u0648\u0631 \u062F\u0644\u0646\u0634\u06CC\u0646", image: IMG.living2, count: 24 },
  { id: "co2", slug: "quiet-bedroom", title: "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628\u0650 \u0622\u0631\u0627\u0645", subtitle: "\u062E\u0627\u0631\u062C \u0627\u0632 \u0647\u06CC\u0627\u0647\u0648\u06CC \u0631\u0648\u0632", image: IMG.bed4, count: 18 },
  { id: "co3", slug: "monochrome", title: "\u062A\u06A9\u200C\u0631\u0646\u06AF\u0650 \u0634\u06CC\u06A9", subtitle: "\u0633\u06CC\u0627\u0647\u060C \u0633\u0641\u06CC\u062F \u0648 \u0637\u0648\u0633\u06CC", image: IMG.living7, count: 31 },
  { id: "co4", slug: "natural-textures", title: "\u0628\u0627\u0641\u062A\u200C\u0647\u0627\u06CC \u0637\u0628\u06CC\u0639\u06CC", subtitle: "\u0686\u0648\u0628\u060C \u06A9\u062A\u0627\u0646 \u0648 \u0633\u0646\u06AF", image: IMG.decor6, count: 22 },
  { id: "co5", slug: "reading-corner", title: "\u06AF\u0648\u0634\u0647\u200C\u06CC \u0645\u0637\u0627\u0644\u0639\u0647", subtitle: "\u0645\u0628\u0644\u060C \u0686\u0631\u0627\u063A \u0648 \u0622\u0631\u0627\u0645\u0634", image: IMG.decor7, count: 15 },
  { id: "co6", slug: "small-space", title: "\u0631\u0627\u0647\u06A9\u0627\u0631 \u062E\u0627\u0646\u0647\u200C\u06CC \u06A9\u0648\u0686\u06A9", subtitle: "\u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0627\u0632 \u06A9\u0645\u062A\u0631\u06CC\u0646 \u0641\u0636\u0627", image: IMG.living8, count: 27 }
];

// src/data/categories.ts
var categories2 = [
  {
    id: "c1",
    slug: "furniture",
    name: "\u0645\u0628\u0644\u0645\u0627\u0646",
    nameEn: "Furniture",
    description: "\u0645\u0628\u0644\u060C \u06A9\u0627\u0646\u0627\u067E\u0647\u060C \u0635\u0646\u062F\u0644\u06CC \u0648 \u0645\u06CC\u0632 \u0628\u0631\u0627\u06CC \u0647\u0631 \u0641\u0636\u0627\u06CC\u06CC \u0627\u0632 \u062E\u0627\u0646\u0647\u200C\u0627\u062A",
    icon: "Sofa",
    image: IMG.living2,
    productCount: 1280,
    subcategories: [
      { id: "s1", slug: "sofa", name: "\u06A9\u0627\u0646\u0627\u067E\u0647" },
      { id: "s2", slug: "armchair", name: "\u0645\u0628\u0644 \u0631\u0627\u062D\u062A\u06CC" },
      { id: "s3", slug: "chair", name: "\u0635\u0646\u062F\u0644\u06CC" },
      { id: "s4", slug: "coffee-table", name: "\u0645\u06CC\u0632 \u062C\u0644\u0648 \u0645\u0628\u0644\u06CC" },
      { id: "s5", slug: "dining-table", name: "\u0645\u06CC\u0632 \u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC" },
      { id: "s6", slug: "dining-chair", name: "\u0635\u0646\u062F\u0644\u06CC \u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC" }
    ]
  },
  {
    id: "c2",
    slug: "decor",
    name: "\u062F\u06A9\u0648\u0631\u0627\u0633\u06CC\u0648\u0646",
    nameEn: "Decor",
    description: "\u062A\u0627\u0628\u0644\u0648\u060C \u0622\u06CC\u0646\u0647\u060C \u06AF\u0644\u062F\u0627\u0646 \u0648 \u0627\u06A9\u0633\u0633\u0648\u0631\u06CC \u0628\u0631\u0627\u06CC \u0631\u0648\u062D \u0628\u062E\u0634\u06CC\u062F\u0646 \u0628\u0647 \u0641\u0636\u0627",
    icon: "Frame",
    image: IMG.decor6,
    productCount: 940,
    subcategories: [
      { id: "s7", slug: "wall-art", name: "\u062A\u0627\u0628\u0644\u0648" },
      { id: "s8", slug: "mirror", name: "\u0622\u06CC\u0646\u0647" },
      { id: "s9", slug: "vase", name: "\u06AF\u0644\u062F\u0627\u0646" },
      { id: "s10", slug: "accessories", name: "\u0627\u06A9\u0633\u0633\u0648\u0631\u06CC" },
      { id: "s11", slug: "sculpture", name: "\u0645\u062C\u0633\u0645\u0647" },
      { id: "s12", slug: "candle", name: "\u0634\u0645\u0639 \u0648 \u062F\u06A9\u0648\u0631\u06CC" }
    ]
  },
  {
    id: "c3",
    slug: "lighting",
    name: "\u0646\u0648\u0631\u067E\u0631\u062F\u0627\u0632\u06CC",
    nameEn: "Lighting",
    description: "\u0686\u0631\u0627\u063A \u0633\u0642\u0641\u06CC\u060C \u0622\u0628\u0627\u0698\u0648\u0631 \u0648 \u0646\u0648\u0631\u0647\u0627\u06CC \u062F\u06A9\u0648\u0631\u0627\u062A\u06CC\u0648 \u0628\u0631\u0627\u06CC \u0627\u06CC\u062C\u0627\u062F \u062D\u0633 \u0648 \u062D\u0627\u0644",
    icon: "Lamp",
    image: IMG.decor3,
    productCount: 612,
    subcategories: [
      { id: "s13", slug: "ceiling", name: "\u0686\u0631\u0627\u063A \u0633\u0642\u0641\u06CC" },
      { id: "s14", slug: "floor-lamp", name: "\u0622\u0628\u0627\u0698\u0648\u0631" },
      { id: "s15", slug: "wall-lamp", name: "\u0686\u0631\u0627\u063A \u062F\u06CC\u0648\u0627\u0631\u06CC" },
      { id: "s16", slug: "table-lamp", name: "\u0686\u0631\u0627\u063A \u0631\u0648\u0645\u06CC\u0632\u06CC" },
      { id: "s17", slug: "decorative", name: "\u0646\u0648\u0631\u0647\u0627\u06CC \u062F\u06A9\u0648\u0631\u0627\u062A\u06CC\u0648" }
    ]
  },
  {
    id: "c4",
    slug: "rugs",
    name: "\u0641\u0631\u0634 \u0648 \u06A9\u0641",
    nameEn: "Rugs & Flooring",
    description: "\u0641\u0631\u0634\u060C \u0642\u0627\u0644\u06CC\u0686\u0647 \u0648 \u06A9\u0641\u200C\u067E\u0648\u0634 \u0628\u0631\u0627\u06CC \u06AF\u0631\u0645 \u06A9\u0631\u062F\u0646 \u0632\u06CC\u0631 \u067E\u0627",
    icon: "SquareStack",
    image: IMG.decor10,
    productCount: 388,
    subcategories: [
      { id: "s18", slug: "carpet", name: "\u0641\u0631\u0634" },
      { id: "s19", slug: "rug", name: "\u0642\u0627\u0644\u06CC\u0686\u0647" },
      { id: "s20", slug: "flooring", name: "\u06A9\u0641\u200C\u067E\u0648\u0634" }
    ]
  },
  {
    id: "c5",
    slug: "textiles",
    name: "\u067E\u0631\u062F\u0647 \u0648 \u0645\u0646\u0633\u0648\u062C\u0627\u062A",
    nameEn: "Textiles",
    description: "\u067E\u0631\u062F\u0647\u060C \u06A9\u0648\u0633\u0646\u060C \u067E\u062A\u0648 \u0648 \u0631\u0648\u0645\u06CC\u0632\u06CC \u0628\u0627 \u0628\u0627\u0641\u062A\u200C\u0647\u0627\u06CC \u062F\u0644\u0646\u0634\u06CC\u0646",
    icon: "Waves",
    image: IMG.living6,
    productCount: 521,
    subcategories: [
      { id: "s21", slug: "curtain", name: "\u067E\u0631\u062F\u0647" },
      { id: "s22", slug: "cushion", name: "\u06A9\u0648\u0633\u0646" },
      { id: "s23", slug: "throw", name: "\u067E\u062A\u0648 \u0648 \u067E\u0648\u0634\u0627\u0644\u06CC" },
      { id: "s24", slug: "table-runner", name: "\u0631\u0648\u0645\u06CC\u0632\u06CC" }
    ]
  },
  {
    id: "c6",
    slug: "kitchen",
    name: "\u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647",
    nameEn: "Kitchen",
    description: "\u0638\u0631\u0648\u0641\u060C \u0644\u0648\u0627\u0632\u0645 \u0648 \u0627\u06A9\u0633\u0633\u0648\u0631\u06CC \u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647 \u0628\u0631\u0627\u06CC \u06CC\u06A9 \u062A\u062C\u0631\u0628\u0647\u200C\u06CC \u062F\u0644\u067E\u0630\u06CC\u0631",
    icon: "UtensilsCrossed",
    image: IMG.bed3,
    productCount: 733,
    subcategories: [
      { id: "s25", slug: "dinnerware", name: "\u0638\u0631\u0648\u0641" },
      { id: "s26", slug: "cookware", name: "\u0644\u0648\u0627\u0632\u0645 \u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647" },
      { id: "s27", slug: "organizer", name: "\u0646\u0638\u0645\u200C\u062F\u0647\u0646\u062F\u0647" }
    ]
  },
  {
    id: "c7",
    slug: "bedroom",
    name: "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628",
    nameEn: "Bedroom",
    description: "\u062A\u062E\u062A\u060C \u06A9\u0645\u062F \u0648 \u0631\u0648\u062A\u062E\u062A\u06CC \u0628\u0631\u0627\u06CC \u06CC\u06A9 \u0627\u0633\u062A\u0631\u0627\u062D\u062A\u200C\u06AF\u0627\u0647 \u0622\u0631\u0627\u0645\u0634\u200C\u0628\u062E\u0634",
    icon: "BedDouble",
    image: IMG.bed2,
    productCount: 456,
    subcategories: [
      { id: "s28", slug: "bed", name: "\u062A\u062E\u062A" },
      { id: "s29", slug: "nightstand", name: "\u0645\u06CC\u0632 \u06A9\u0646\u0627\u0631 \u062A\u062E\u062A" },
      { id: "s30", slug: "wardrobe", name: "\u06A9\u0645\u062F" },
      { id: "s31", slug: "bedding", name: "\u0631\u0648\u062A\u062E\u062A\u06CC" }
    ]
  },
  {
    id: "c8",
    slug: "workspace",
    name: "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631",
    nameEn: "Workspace",
    description: "\u0645\u06CC\u0632\u060C \u0635\u0646\u062F\u0644\u06CC \u0648 \u0646\u0638\u0645\u200C\u062F\u0647\u0646\u062F\u0647 \u0628\u0631\u0627\u06CC \u06CC\u06A9 \u0645\u062D\u06CC\u0637 \u06A9\u0627\u0631 \u0628\u0627 \u062A\u0645\u0631\u06A9\u0632",
    icon: "Briefcase",
    image: IMG.decor7,
    productCount: 298,
    subcategories: [
      { id: "s32", slug: "desk", name: "\u0645\u06CC\u0632 \u06A9\u0627\u0631" },
      { id: "s33", slug: "office-chair", name: "\u0635\u0646\u062F\u0644\u06CC \u0627\u062F\u0627\u0631\u06CC" },
      { id: "s34", slug: "organizer", name: "\u0646\u0638\u0645\u200C\u062F\u0647\u0646\u062F\u0647" }
    ]
  },
  {
    id: "c9",
    slug: "outdoor",
    name: "\u0641\u0636\u0627\u06CC \u0628\u06CC\u0631\u0648\u0646\u06CC",
    nameEn: "Outdoor",
    description: "\u0645\u0628\u0644\u0645\u0627\u0646 \u0628\u0627\u063A\u060C \u06AF\u0644\u062F\u0627\u0646 \u0648 \u0646\u0648\u0631\u067E\u0631\u062F\u0627\u0632\u06CC \u0628\u0631\u0627\u06CC \u0628\u0627\u0644\u06A9\u0646 \u0648 \u062D\u06CC\u0627\u0637",
    icon: "Trees",
    image: IMG.living5,
    productCount: 213,
    subcategories: [
      { id: "s35", slug: "outdoor-furniture", name: "\u0645\u0628\u0644\u0645\u0627\u0646 \u0641\u0636\u0627\u06CC \u0628\u0627\u0632" },
      { id: "s36", slug: "planter", name: "\u06AF\u0644\u062F\u0627\u0646 \u0628\u0627\u063A\u06CC" },
      { id: "s37", slug: "outdoor-light", name: "\u0646\u0648\u0631\u067E\u0631\u062F\u0627\u0632\u06CC \u0628\u06CC\u0631\u0648\u0646\u06CC" }
    ]
  }
];

// src/data/styles.ts
var styles2 = [
  {
    id: "style-modern",
    slug: "modern",
    name: "\u0645\u062F\u0631\u0646",
    nameEn: "Modern",
    tagline: "\u062E\u0637\u0648\u0637 \u062A\u0645\u06CC\u0632\u060C \u0641\u0631\u0645\u200C\u0647\u0627\u06CC \u0633\u0627\u062F\u0647 \u0648 \u06A9\u0627\u0631\u0627\u06CC\u06CC",
    shortDescription: "\u0641\u0631\u0645\u200C\u0647\u0627\u06CC \u0633\u0627\u062F\u0647\u060C \u067E\u0644\u0627\u0646 \u0628\u0627\u0632 \u0648 \u0645\u0635\u0627\u0644\u062D \u0635\u0627\u062F\u0642\u0627\u0646\u0647\u061B \u0633\u0628\u06A9\u06CC \u0631\u06CC\u0634\u0647\u200C\u062F\u0627\u0631 \u062F\u0631 \u0637\u0631\u0627\u062D\u06CC \u0642\u0631\u0646 \u0628\u06CC\u0633\u062A\u0645 \u06A9\u0647 \u0647\u0646\u0648\u0632 \u062F\u0642\u06CC\u0642 \u0648 \u06A9\u0627\u0631\u0628\u0631\u062F\u06CC \u0627\u0633\u062A.",
    description: "\u0633\u0628\u06A9 \u0645\u062F\u0631\u0646 \u0627\u0632 \u062C\u0646\u0628\u0634 \u0645\u062F\u0631\u0646\u06CC\u0633\u0645 \u0645\u06CC\u200C\u0622\u06CC\u062F \u0648 \u0628\u0631 \u0639\u0645\u0644\u06A9\u0631\u062F\u060C \u062E\u0637\u0648\u0637 \u0627\u0641\u0642\u06CC \u0648 \u0639\u0645\u0648\u062F\u06CC \u0631\u0648\u0634\u0646 \u0648 \u062D\u0630\u0641 \u062A\u0632\u0626\u06CC\u0646\u0627\u062A \u063A\u06CC\u0631\u0636\u0631\u0648\u0631\u06CC \u062A\u06A9\u06CC\u0647 \u062F\u0627\u0631\u062F. \u0628\u0631\u062E\u0644\u0627\u0641 \u0633\u0628\u06A9 \u0645\u0639\u0627\u0635\u0631 \u06A9\u0647 \u0628\u0627 \u062A\u0631\u0646\u062F\u0647\u0627\u06CC \u0631\u0648\u0632 \u062A\u063A\u06CC\u06CC\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F\u060C \u0645\u062F\u0631\u0646 \u0642\u0648\u0627\u0639\u062F \u062A\u0627\u0631\u06CC\u062E\u06CC \u0645\u0634\u062E\u0635\u06CC \u062F\u0627\u0631\u062F: \u0641\u0631\u0645 \u0627\u0632 \u0639\u0645\u0644\u06A9\u0631\u062F \u067E\u06CC\u0631\u0648\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u0647\u0631 \u0642\u0637\u0639\u0647 \u0628\u0627\u06CC\u062F \u062F\u0644\u06CC\u0644 \u062D\u0636\u0648\u0631\u0634 \u0631\u0627 \u0646\u0634\u0627\u0646 \u062F\u0647\u062F.",
    image: IMG.styleModern,
    imageAlt: "\u0646\u0634\u06CC\u0645\u0646 \u0645\u062F\u0631\u0646 \u0628\u0627 \u067E\u0644\u0627\u0646 \u0628\u0627\u0632\u060C \u062E\u0637\u0648\u0637 \u0645\u0633\u062A\u0642\u06CC\u0645 \u0648 \u0645\u0628\u0644\u0645\u0627\u0646 \u0633\u0627\u062F\u0647",
    colorPalette: [
      { name: "\u0633\u0641\u06CC\u062F \u06AF\u0631\u0645", hex: "#F2EFE8" },
      { name: "\u062E\u0627\u06A9\u0633\u062A\u0631\u06CC \u0633\u0646\u06AF\u06CC", hex: "#AAA9A4" },
      { name: "\u0630\u063A\u0627\u0644\u06CC", hex: "#303332" },
      { name: "\u06AF\u0631\u062F\u0648\u06CC\u06CC", hex: "#806044" },
      { name: "\u0633\u0628\u0632 \u062A\u0623\u06A9\u06CC\u062F\u06CC", hex: "#315C4B" }
    ],
    materials: ["\u0686\u0648\u0628 \u0628\u0627 \u0631\u06AF\u0647\u200C\u06CC \u0637\u0628\u06CC\u0639\u06CC", "\u0634\u06CC\u0634\u0647", "\u0641\u0648\u0644\u0627\u062F", "\u0628\u062A\u0646", "\u0686\u0631\u0645 \u0633\u0627\u062F\u0647"],
    keyFeatures: ["\u067E\u0644\u0627\u0646 \u0628\u0627\u0632 \u0648 \u06AF\u0631\u062F\u0634 \u0622\u0633\u0627\u0646", "\u062E\u0637\u0648\u0637 \u0645\u0633\u062A\u0642\u06CC\u0645 \u0648 \u0647\u0646\u062F\u0633\u06CC", "\u06A9\u0627\u0631\u06A9\u0631\u062F \u0645\u0642\u062F\u0645 \u0628\u0631 \u062A\u0632\u0626\u06CC\u0646", "\u06A9\u0646\u062A\u0631\u0627\u0633\u062A \u06A9\u0646\u062A\u0631\u0644\u200C\u0634\u062F\u0647"],
    furnitureCharacteristics: "\u0645\u0628\u0644\u0645\u0627\u0646 \u06A9\u0645\u200C\u0627\u0631\u062A\u0641\u0627\u0639 \u0628\u0627 \u067E\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u0646\u0645\u0627\u06CC\u0627\u0646\u060C \u062D\u062C\u0645\u200C\u0647\u0627\u06CC \u062E\u0648\u0627\u0646\u0627 \u0648 \u0631\u0648\u06A9\u0634\u200C\u0647\u0627\u06CC \u06CC\u06A9\u062F\u0633\u062A\u061B \u0642\u0637\u0639\u0627\u062A \u0634\u0627\u062E\u0635 \u0642\u0631\u0646 \u0645\u06CC\u0627\u0646\u0647 \u0647\u0645 \u0628\u0647\u200C\u062E\u0648\u0628\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0641\u0636\u0627 \u0645\u06CC\u200C\u0646\u0634\u06CC\u0646\u0646\u062F.",
    lightingCharacteristics: "\u0646\u0648\u0631 \u0637\u0628\u06CC\u0639\u06CC \u06AF\u0633\u062A\u0631\u062F\u0647 \u062F\u0631 \u06A9\u0646\u0627\u0631 \u0686\u0631\u0627\u063A\u200C\u0647\u0627\u06CC \u062E\u0637\u06CC\u060C \u0622\u0648\u06CC\u0632\u0647\u0627\u06CC \u0647\u0646\u062F\u0633\u06CC \u0648 \u0646\u0648\u0631 \u0648\u0638\u06CC\u0641\u0647\u200C\u0627\u06CC \u0628\u062F\u0648\u0646 \u062A\u0632\u0626\u06CC\u0646\u0627\u062A \u0627\u0636\u0627\u0641\u0647.",
    formCharacteristics: "\u062E\u0637\u0648\u0637 \u0635\u0627\u0641\u060C \u0627\u062D\u062C\u0627\u0645 \u0645\u06A9\u0639\u0628\u06CC\u060C \u06AF\u0648\u0634\u0647\u200C\u0647\u0627\u06CC \u062F\u0642\u06CC\u0642 \u0648 \u062A\u0631\u06A9\u06CC\u0628 \u0645\u062D\u062F\u0648\u062F \u0645\u0646\u062D\u0646\u06CC \u0628\u0631\u0627\u06CC \u0646\u0631\u0645\u200C\u06A9\u0631\u062F\u0646 \u0641\u0636\u0627.",
    decorCharacteristics: "\u0622\u062B\u0627\u0631 \u0647\u0646\u0631\u06CC \u0628\u0632\u0631\u06AF \u0648 \u0645\u062D\u062F\u0648\u062F\u060C \u06AF\u06CC\u0627\u0647\u0627\u0646 \u0633\u0627\u062E\u062A\u0627\u0631\u06CC \u0648 \u0627\u0634\u06CC\u0627\u06CC \u06A9\u0627\u0631\u0628\u0631\u062F\u06CC\u061B \u0633\u0637\u0648\u062D \u062A\u0627 \u062D\u062F \u0645\u0645\u06A9\u0646 \u0622\u0632\u0627\u062F \u0645\u06CC\u200C\u0645\u0627\u0646\u0646\u062F.",
    visualDensity: "\u06A9\u0645 \u062A\u0627 \u0645\u062A\u0648\u0633\u0637\u061B \u0641\u0636\u0627 \u062E\u0644\u0648\u062A \u0627\u0633\u062A \u0627\u0645\u0627 \u0627\u0644\u0632\u0627\u0645\u0627\u064B \u062A\u0647\u06CC \u06CC\u0627 \u062A\u06A9\u200C\u0631\u0646\u06AF \u0646\u06CC\u0633\u062A.",
    suitableFor: "\u0627\u0641\u0631\u0627\u062F\u06CC \u06A9\u0647 \u0646\u0638\u0645 \u0628\u0635\u0631\u06CC\u060C \u06A9\u0627\u0631\u0627\u06CC\u06CC \u0648 \u0637\u0631\u0627\u062D\u06CC \u0645\u0627\u0646\u062F\u06AF\u0627\u0631 \u0631\u0627 \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0646\u062F \u0648 \u0627\u0632 \u062F\u06A9\u0648\u0631\u0647\u0627\u06CC \u067E\u0631\u062C\u0632\u0626\u06CC\u0627\u062A \u062F\u0648\u0631\u06CC \u0645\u06CC\u200C\u06A9\u0646\u0646\u062F.",
    suitableRooms: ["\u0646\u0634\u06CC\u0645\u0646", "\u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647", "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631", "\u0622\u067E\u0627\u0631\u062A\u0645\u0627\u0646\u200C\u0647\u0627\u06CC \u067E\u0644\u0627\u0646 \u0628\u0627\u0632"],
    comparisonNote: "\u0645\u062F\u0631\u0646 \u06CC\u06A9 \u0633\u0628\u06A9 \u062A\u0627\u0631\u06CC\u062E\u06CC \u0628\u0627 \u0627\u0635\u0648\u0644 \u062B\u0627\u0628\u062A \u0627\u0633\u062A\u061B \u0645\u0639\u0627\u0635\u0631 \u062A\u0635\u0648\u06CC\u0631\u0650 \u0627\u0645\u0631\u0648\u0632 \u0637\u0631\u0627\u062D\u06CC \u0627\u0633\u062A \u0648 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0639\u0646\u0627\u0635\u0631 \u0645\u0646\u062D\u0646\u06CC\u060C \u0647\u0646\u0631\u06CC \u0648 \u062A\u0631\u0646\u062F\u0645\u062D\u0648\u0631 \u0628\u06CC\u0634\u062A\u0631\u06CC \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F."
  },
  {
    id: "style-minimal",
    slug: "minimal",
    name: "\u0645\u06CC\u0646\u06CC\u0645\u0627\u0644",
    nameEn: "Minimal",
    tagline: "\u06A9\u0645\u062A\u0631\u060C \u0627\u0645\u0627 \u0628\u0647\u062A\u0631",
    shortDescription: "\u0641\u0636\u0627\u06CC\u06CC \u0633\u0646\u062C\u06CC\u062F\u0647 \u06A9\u0647 \u062F\u0631 \u0622\u0646 \u0647\u0631 \u0648\u0633\u06CC\u0644\u0647 \u0636\u0631\u0648\u0631\u06CC \u0627\u0633\u062A \u0648 \u06A9\u06CC\u0641\u06CC\u062A \u0646\u0648\u0631\u060C \u062A\u0646\u0627\u0633\u0628 \u0648 \u0641\u0636\u0627\u06CC \u062E\u0627\u0644\u06CC \u0628\u0647 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06CC \u062E\u0648\u062F \u0645\u0628\u0644\u0645\u0627\u0646 \u0627\u0647\u0645\u06CC\u062A \u062F\u0627\u0631\u062F.",
    description: "\u0645\u06CC\u0646\u06CC\u0645\u0627\u0644\u06CC\u0633\u0645 \u0635\u0631\u0641\u0627\u064B \u0633\u0641\u06CC\u062F\u06A9\u0631\u062F\u0646 \u0641\u0636\u0627 \u06CC\u0627 \u06A9\u0645\u200C\u06A9\u0631\u062F\u0646 \u0648\u0633\u0627\u06CC\u0644 \u0646\u06CC\u0633\u062A\u061B \u0627\u0646\u062A\u062E\u0627\u0628 \u0622\u06AF\u0627\u0647\u0627\u0646\u0647\u060C \u0630\u062E\u06CC\u0631\u0647\u200C\u0633\u0627\u0632\u06CC \u067E\u0646\u0647\u0627\u0646 \u0648 \u06A9\u06CC\u0641\u06CC\u062A \u0627\u062C\u0631\u0627\u06CC \u062C\u0632\u0626\u06CC\u0627\u062A \u0627\u0633\u0627\u0633 \u0622\u0646 \u0627\u0633\u062A. \u0627\u06CC\u0646 \u0633\u0628\u06A9 \u0628\u0627 \u0645\u062D\u062F\u0648\u062F\u06A9\u0631\u062F\u0646 \u0645\u062D\u0631\u06A9\u200C\u0647\u0627\u06CC \u0628\u0635\u0631\u06CC\u060C \u0645\u062D\u06CC\u0637\u06CC \u0622\u0631\u0627\u0645 \u0648 \u06A9\u0627\u0631\u0628\u0631\u062F\u06CC \u0645\u06CC\u200C\u0633\u0627\u0632\u062F \u0648 \u0627\u062C\u0627\u0632\u0647 \u0645\u06CC\u200C\u062F\u0647\u062F \u0628\u0627\u0641\u062A\u060C \u0646\u0648\u0631 \u0648 \u062A\u0646\u0627\u0633\u0628 \u062F\u06CC\u062F\u0647 \u0634\u0648\u0646\u062F.",
    image: IMG.styleMinimal,
    imageAlt: "\u0641\u0636\u0627\u06CC \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644 \u0631\u0648\u0634\u0646 \u0628\u0627 \u0645\u0628\u0644\u0645\u0627\u0646 \u0645\u062D\u062F\u0648\u062F \u0648 \u0641\u0636\u0627\u06CC \u062E\u0627\u0644\u06CC \u0633\u0646\u062C\u06CC\u062F\u0647",
    colorPalette: [
      { name: "\u0633\u0641\u06CC\u062F \u0634\u06CC\u0631\u06CC", hex: "#F7F4EC" },
      { name: "\u0628\u0698 \u0631\u0648\u0634\u0646", hex: "#DDD3C3" },
      { name: "\u062E\u0627\u06A9\u0633\u062A\u0631\u06CC \u06AF\u0631\u0645", hex: "#A7A198" },
      { name: "\u0642\u0647\u0648\u0647\u200C\u0627\u06CC \u0646\u0631\u0645", hex: "#75685B" },
      { name: "\u0645\u0634\u06A9\u06CC \u0646\u0642\u0637\u0647\u200C\u0627\u06CC", hex: "#252525" }
    ],
    materials: ["\u06AF\u0686 \u0648 \u0631\u0646\u06AF \u0645\u0627\u062A", "\u0686\u0648\u0628 \u0631\u0648\u0634\u0646", "\u0633\u0646\u06AF \u06CC\u06A9\u067E\u0627\u0631\u0686\u0647", "\u06A9\u062A\u0627\u0646", "\u0641\u0644\u0632 \u0628\u0627 \u067E\u0631\u062F\u0627\u062E\u062A \u0645\u0627\u062A"],
    keyFeatures: ["\u0641\u0636\u0627\u06CC \u062E\u0627\u0644\u06CC \u0647\u062F\u0641\u0645\u0646\u062F", "\u0630\u062E\u06CC\u0631\u0647\u200C\u0633\u0627\u0632\u06CC \u067E\u0646\u0647\u0627\u0646", "\u062A\u0639\u062F\u0627\u062F \u0631\u0646\u06AF \u0645\u062D\u062F\u0648\u062F", "\u062C\u0632\u0626\u06CC\u0627\u062A \u0627\u062C\u0631\u0627\u06CC\u06CC \u062F\u0642\u06CC\u0642"],
    furnitureCharacteristics: "\u0642\u0637\u0639\u0627\u062A \u0636\u0631\u0648\u0631\u06CC \u0628\u0627 \u067E\u0631\u0648\u0641\u06CC\u0644 \u0628\u0627\u0631\u06CC\u06A9\u060C \u062E\u0637\u0648\u0637 \u062E\u0627\u0644\u0635\u060C \u0627\u0631\u062A\u0641\u0627\u0639 \u0645\u0646\u0627\u0633\u0628 \u0648 \u0686\u0646\u062F \u06A9\u0627\u0631\u0628\u0631\u062F\u061B \u0628\u062F\u0648\u0646 \u062C\u0632\u0626\u06CC\u0627\u062A \u0646\u0645\u0627\u06CC\u0634\u06CC \u06CC\u0627 \u062D\u062C\u0645 \u0627\u0636\u0627\u0641\u0647.",
    lightingCharacteristics: "\u0646\u0648\u0631 \u0637\u0628\u06CC\u0639\u06CC \u0646\u0631\u0645\u060C \u0646\u0648\u0631 \u0645\u062E\u0641\u06CC \u0645\u0639\u0645\u0627\u0631\u06CC \u0648 \u0686\u0631\u0627\u063A\u200C\u0647\u0627\u06CC \u0633\u0627\u062F\u0647 \u0628\u0627 \u067E\u062E\u0634 \u06CC\u06A9\u0646\u0648\u0627\u062E\u062A\u061B \u062E\u06CC\u0631\u06AF\u06CC \u0648 \u062A\u0639\u062F\u062F \u0645\u0646\u0627\u0628\u0639 \u06A9\u0646\u062A\u0631\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F.",
    formCharacteristics: "\u0647\u0646\u062F\u0633\u0647\u200C\u06CC \u062E\u0627\u0644\u0635\u060C \u0633\u0637\u0648\u062D \u067E\u06CC\u0648\u0633\u062A\u0647 \u0648 \u062A\u06A9\u0631\u0627\u0631 \u0622\u0631\u0627\u0645 \u062E\u0637\u0648\u0637\u061B \u0647\u0631 \u0641\u0631\u0645 \u0628\u0627\u06CC\u062F \u062E\u0648\u0627\u0646\u0627 \u0648 \u0628\u062F\u0648\u0646 \u0627\u063A\u062A\u0634\u0627\u0634 \u0628\u0627\u0634\u062F.",
    decorCharacteristics: "\u06CC\u06A9 \u06CC\u0627 \u062F\u0648 \u0627\u062B\u0631 \u0647\u0646\u0631\u06CC\u060C \u0633\u0631\u0627\u0645\u06CC\u06A9 \u062F\u0633\u062A\u200C\u0633\u0627\u0632 \u06CC\u0627 \u06AF\u06CC\u0627\u0647 \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647\u061B \u062A\u0632\u0626\u06CC\u0646\u0627\u062A \u067E\u0631\u0627\u06A9\u0646\u062F\u0647 \u062C\u0627\u06CC \u062E\u0648\u062F \u0631\u0627 \u0628\u0647 \u0646\u0642\u0637\u0647\u200C\u06CC \u06A9\u0627\u0646\u0648\u0646\u06CC \u0645\u06CC\u200C\u062F\u0647\u0646\u062F.",
    visualDensity: "\u0628\u0633\u06CC\u0627\u0631 \u06A9\u0645\u061B \u0641\u0636\u0627\u06CC \u0645\u0646\u0641\u06CC \u06CC\u06A9\u06CC \u0627\u0632 \u0639\u0646\u0627\u0635\u0631 \u0627\u0635\u0644\u06CC \u062A\u0631\u06A9\u06CC\u0628 \u0627\u0633\u062A.",
    suitableFor: "\u0627\u0641\u0631\u0627\u062F\u06CC \u06A9\u0647 \u0645\u062D\u06CC\u0637 \u0622\u0631\u0627\u0645\u060C \u062E\u0644\u0648\u062A\u060C \u06A9\u0645\u200C\u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0648 \u062A\u0635\u0645\u06CC\u0645\u200C\u0647\u0627\u06CC \u062E\u0631\u06CC\u062F \u062D\u0633\u0627\u0628\u200C\u0634\u062F\u0647 \u0631\u0627 \u062A\u0631\u062C\u06CC\u062D \u0645\u06CC\u200C\u062F\u0647\u0646\u062F.",
    suitableRooms: ["\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628", "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631", "\u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647 \u06A9\u0648\u0686\u06A9", "\u0646\u0634\u06CC\u0645\u0646 \u0622\u067E\u0627\u0631\u062A\u0645\u0627\u0646\u06CC"],
    comparisonNote: "\u0645\u06CC\u0646\u06CC\u0645\u0627\u0644 \u0627\u0632 \u0647\u0631 \u0639\u0646\u0635\u0631 \u063A\u06CC\u0631\u0636\u0631\u0648\u0631\u06CC \u0645\u06CC\u200C\u06A9\u0627\u0647\u062F\u061B \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC \u0647\u0645\u06CC\u0646 \u0633\u0627\u062F\u06AF\u06CC \u0631\u0627 \u0628\u0627 \u0628\u0627\u0641\u062A \u0646\u0631\u0645\u060C \u062D\u0633 \u062E\u0627\u0646\u06AF\u06CC \u0648 \u0644\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u06AF\u0631\u0645\u200C\u062A\u0631 \u0647\u0645\u0631\u0627\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F."
  },
  {
    id: "style-scandinavian",
    slug: "scandinavian",
    name: "\u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC",
    nameEn: "Scandinavian",
    tagline: "\u06AF\u0631\u0645\u0627\u06CC \u0686\u0648\u0628\u060C \u0646\u0648\u0631 \u0648 \u0622\u0631\u0627\u0645\u0634",
    shortDescription: "\u0633\u0627\u062F\u06AF\u06CC \u06A9\u0627\u0631\u0628\u0631\u062F\u06CC \u0628\u0627 \u0686\u0648\u0628 \u0631\u0648\u0634\u0646\u060C \u067E\u0627\u0631\u0686\u0647\u200C\u0647\u0627\u06CC \u0631\u0627\u062D\u062A \u0648 \u0646\u0648\u0631 \u0641\u0631\u0627\u0648\u0627\u0646\u061B \u062E\u0627\u0646\u0647\u200C\u0627\u06CC \u0635\u0645\u06CC\u0645\u06CC \u0628\u0631\u0627\u06CC \u0632\u0646\u062F\u06AF\u06CC \u0631\u0648\u0632\u0645\u0631\u0647\u060C \u0646\u0647 \u06CC\u06A9 \u0641\u0636\u0627\u06CC \u0646\u0645\u0627\u06CC\u0634\u06CC.",
    description: "\u0637\u0631\u0627\u062D\u06CC \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC \u067E\u0627\u0633\u062E \u0627\u0642\u0644\u06CC\u0645 \u0634\u0645\u0627\u0644 \u0627\u0631\u0648\u067E\u0627 \u0628\u0647 \u0632\u0645\u0633\u062A\u0627\u0646\u200C\u0647\u0627\u06CC \u0637\u0648\u0644\u0627\u0646\u06CC \u0627\u0633\u062A: \u0628\u06CC\u0634\u06CC\u0646\u0647\u200C\u06A9\u0631\u062F\u0646 \u0646\u0648\u0631\u060C \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0627\u0632 \u0645\u0648\u0627\u062F \u0637\u0628\u06CC\u0639\u06CC \u0648 \u0633\u0627\u062E\u062A\u0646 \u062D\u0633 \u0631\u0627\u062D\u062A\u06CC \u06CC\u0627 \xAB\u0647\u0648\u06AF\u0647\xBB. \u062E\u0637\u0648\u0637 \u0633\u0627\u062F\u0647\u200C\u0627\u0646\u062F\u060C \u0627\u0645\u0627 \u0628\u0631\u062E\u0644\u0627\u0641 \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644\u06CC\u0633\u0645 \u0633\u062E\u062A\u200C\u06AF\u06CC\u0631\u0627\u0646\u0647\u060C \u06A9\u0648\u0633\u0646\u060C \u0628\u0627\u0641\u062A\u060C \u06A9\u062A\u0627\u0628 \u0648 \u0627\u0634\u06CC\u0627\u06CC \u0631\u0648\u0632\u0645\u0631\u0647 \u0628\u0647 \u0641\u0636\u0627 \u06AF\u0631\u0645\u0627 \u0648 \u0632\u0646\u062F\u06AF\u06CC \u0645\u06CC\u200C\u062F\u0647\u0646\u062F.",
    image: IMG.styleScandinavian,
    imageAlt: "\u0646\u0634\u06CC\u0645\u0646 \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC \u0631\u0648\u0634\u0646 \u0628\u0627 \u0686\u0648\u0628 \u0637\u0628\u06CC\u0639\u06CC \u0648 \u067E\u0627\u0631\u0686\u0647\u200C\u0647\u0627\u06CC \u0646\u0631\u0645",
    colorPalette: [
      { name: "\u0633\u0641\u06CC\u062F \u0628\u0631\u0641\u06CC", hex: "#F5F3ED" },
      { name: "\u0628\u0644\u0648\u0637 \u0631\u0648\u0634\u0646", hex: "#C7A980" },
      { name: "\u062E\u0627\u06A9\u0633\u062A\u0631\u06CC \u0645\u0647", hex: "#B7B9B5" },
      { name: "\u0633\u0628\u0632 \u0645\u0631\u06CC\u0645\u200C\u06AF\u0644\u06CC", hex: "#87947D" },
      { name: "\u0622\u0628\u06CC \u062E\u0627\u06A9\u0633\u062A\u0631\u06CC", hex: "#687A84" }
    ],
    materials: ["\u0686\u0648\u0628 \u0628\u0644\u0648\u0637 \u06CC\u0627 \u062A\u0648\u0633", "\u067E\u0634\u0645", "\u06A9\u062A\u0627\u0646", "\u0633\u0631\u0627\u0645\u06CC\u06A9 \u0645\u0627\u062A", "\u062D\u0635\u06CC\u0631"],
    keyFeatures: ["\u0628\u06CC\u0634\u06CC\u0646\u0647\u200C\u0633\u0627\u0632\u06CC \u0646\u0648\u0631 \u0631\u0648\u0632", "\u0633\u0627\u062F\u06AF\u06CC \u0635\u0645\u06CC\u0645\u06CC", "\u0628\u0627\u0641\u062A\u200C\u0647\u0627\u06CC \u0644\u0627\u06CC\u0647\u200C\u0644\u0627\u06CC\u0647", "\u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u0637\u0628\u06CC\u0639\u062A"],
    furnitureCharacteristics: "\u0645\u0628\u0644\u0645\u0627\u0646 \u0633\u0628\u06A9 \u0628\u0627 \u067E\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u0686\u0648\u0628\u06CC \u0628\u0627\u0631\u06CC\u06A9\u060C \u0644\u0628\u0647\u200C\u0647\u0627\u06CC \u0646\u0631\u0645 \u0648 \u0627\u0631\u06AF\u0648\u0646\u0648\u0645\u06CC \u062E\u0648\u0628\u061B \u0631\u0627\u062D\u062A\u06CC \u0648 \u062F\u0648\u0627\u0645 \u0628\u0647 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06CC \u0638\u0627\u0647\u0631 \u0645\u0647\u0645 \u0627\u0633\u062A.",
    lightingCharacteristics: "\u0686\u0646\u062F \u0645\u0646\u0628\u0639 \u0646\u0648\u0631 \u06AF\u0631\u0645 \u062F\u0631 \u0627\u0631\u062A\u0641\u0627\u0639\u200C\u0647\u0627\u06CC \u0645\u062E\u062A\u0644\u0641\u060C \u0622\u0628\u0627\u0698\u0648\u0631\u0647\u0627\u06CC \u06A9\u0627\u063A\u0630\u06CC \u06CC\u0627 \u067E\u0627\u0631\u0686\u0647\u200C\u0627\u06CC \u0648 \u0634\u0645\u0639 \u0628\u0631\u0627\u06CC \u062C\u0628\u0631\u0627\u0646 \u06A9\u0645\u0628\u0648\u062F \u0646\u0648\u0631 \u0631\u0648\u0632.",
    formCharacteristics: "\u062E\u0637\u0648\u0637 \u062A\u0645\u06CC\u0632 \u0647\u0645\u0631\u0627\u0647 \u0628\u0627 \u06AF\u0648\u0634\u0647\u200C\u0647\u0627\u06CC \u06AF\u0631\u062F \u0648 \u0645\u0646\u062D\u0646\u06CC\u200C\u0647\u0627\u06CC \u0622\u0631\u0627\u0645\u061B \u0641\u0631\u0645\u200C\u0647\u0627 \u062F\u0648\u0633\u062A\u0627\u0646\u0647 \u0648 \u0627\u0646\u0633\u0627\u0646\u06CC\u200C\u0627\u0646\u062F.",
    decorCharacteristics: "\u067E\u062A\u0648 \u0648 \u06A9\u0648\u0633\u0646 \u0628\u0627\u0641\u062A\u200C\u062F\u0627\u0631\u060C \u0686\u0627\u067E\u200C\u0647\u0627\u06CC \u06AF\u0631\u0627\u0641\u06CC\u06A9\u06CC \u0633\u0627\u062F\u0647\u060C \u06AF\u06CC\u0627\u0647 \u0648 \u0633\u0631\u0627\u0645\u06CC\u06A9\u061B \u062A\u0632\u0626\u06CC\u0646\u0627\u062A \u0645\u062D\u062F\u0648\u062F \u0627\u0645\u0627 \u0634\u062E\u0635\u06CC \u0647\u0633\u062A\u0646\u062F.",
    visualDensity: "\u06A9\u0645 \u062A\u0627 \u0645\u062A\u0648\u0633\u0637\u061B \u0645\u0646\u0638\u0645 \u0627\u0633\u062A \u0648\u0644\u06CC \u062D\u0633 \u0632\u0646\u062F\u06AF\u06CC \u062F\u0631 \u0622\u0646 \u062D\u0641\u0638 \u0645\u06CC\u200C\u0634\u0648\u062F.",
    suitableFor: "\u062E\u0627\u0646\u0648\u0627\u062F\u0647\u200C\u0647\u0627 \u0648 \u0627\u0641\u0631\u0627\u062F\u06CC \u06A9\u0647 \u062E\u0627\u0646\u0647\u200C\u0627\u06CC \u0631\u0648\u0634\u0646\u060C \u0631\u0627\u062D\u062A\u060C \u0628\u06CC\u200C\u062A\u06A9\u0644\u0641 \u0648 \u0642\u0627\u0628\u0644\u200C\u0632\u0646\u062F\u06AF\u06CC \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0646\u062F.",
    suitableRooms: ["\u0646\u0634\u06CC\u0645\u0646", "\u0627\u062A\u0627\u0642 \u06A9\u0648\u062F\u06A9", "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628", "\u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC"],
    comparisonNote: "\u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC \u0631\u0648\u0634\u0646\u200C\u062A\u0631 \u0648 \u0646\u0631\u0645\u200C\u062A\u0631 \u0627\u0632 \u0698\u0627\u067E\u0646\u062F\u06CC \u0627\u0633\u062A\u061B \u0698\u0627\u067E\u0646\u062F\u06CC \u06A9\u0646\u062A\u0631\u0627\u0633\u062A \u0639\u0645\u06CC\u0642\u200C\u062A\u0631\u060C \u0627\u0631\u062A\u0641\u0627\u0639 \u06A9\u0645\u062A\u0631 \u0648 \u062A\u0623\u06A9\u06CC\u062F \u0628\u06CC\u0634\u062A\u0631\u06CC \u0628\u0631 \u0633\u06A9\u0648\u0646 \u0648 \u0635\u0646\u0639\u062A\u200C\u06AF\u0631\u06CC \u062F\u0627\u0631\u062F."
  },
  {
    id: "style-japandi",
    slug: "japandi",
    name: "\u062C\u0627\u067E\u0646\u062F\u06CC",
    nameEn: "Japandi",
    tagline: "\u062A\u0644\u0627\u0642\u06CC \u0698\u0627\u067E\u0646 \u0648 \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC",
    shortDescription: "\u067E\u06CC\u0648\u0646\u062F \u0641\u0644\u0633\u0641\u0647\u200C\u06CC \u0648\u0627\u0628\u06CC\u200C\u0633\u0627\u0628\u06CC \u0698\u0627\u067E\u0646 \u0628\u0627 \u06A9\u0627\u0631\u0627\u06CC\u06CC \u0648 \u06AF\u0631\u0645\u0627\u06CC \u0634\u0645\u0627\u0644 \u0627\u0631\u0648\u067E\u0627\u061B \u06A9\u0645\u200C\u0648\u0633\u06CC\u0644\u0647\u060C \u0637\u0628\u06CC\u0639\u06CC \u0648 \u0639\u0645\u06CC\u0642\u0627\u064B \u0622\u0631\u0627\u0645.",
    description: "\u0698\u0627\u067E\u0646\u062F\u06CC \u062F\u0648 \u0633\u0646\u062A \u0631\u0627 \u062A\u0631\u06A9\u06CC\u0628 \u0645\u06CC\u200C\u06A9\u0646\u062F: \u0627\u062D\u062A\u0631\u0627\u0645 \u0698\u0627\u067E\u0646\u06CC \u0628\u0647 \u0633\u0627\u062F\u06AF\u06CC\u060C \u0633\u06A9\u0648\u0646 \u0648 \u0632\u06CC\u0628\u0627\u06CC\u06CC \u0646\u0627\u062A\u0645\u0627\u0645\u06CC \u0628\u0627 \u0631\u0627\u062D\u062A\u06CC \u0648 \u0639\u0645\u0644\u06A9\u0631\u062F\u06AF\u0631\u0627\u06CC\u06CC \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC. \u0646\u062A\u06CC\u062C\u0647 \u0627\u0632 \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644 \u06AF\u0631\u0645\u200C\u062A\u0631 \u0648 \u0627\u0632 \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC \u062E\u0644\u0648\u062A\u200C\u062A\u0631 \u0627\u0633\u062A\u061B \u0686\u0648\u0628\u200C\u0647\u0627\u06CC \u0631\u0648\u0634\u0646 \u0648 \u062A\u06CC\u0631\u0647\u060C \u0633\u0641\u0627\u0644 \u062F\u0633\u062A\u200C\u0633\u0627\u0632 \u0648 \u0645\u0628\u0644\u0645\u0627\u0646 \u06A9\u0645\u200C\u0627\u0631\u062A\u0641\u0627\u0639 \u0646\u0642\u0634 \u0627\u0635\u0644\u06CC \u062F\u0627\u0631\u0646\u062F.",
    image: IMG.styleJapandi,
    imageAlt: "\u0641\u0636\u0627\u06CC \u0698\u0627\u067E\u0646\u062F\u06CC \u0622\u0631\u0627\u0645 \u0628\u0627 \u0686\u0648\u0628 \u0637\u0628\u06CC\u0639\u06CC\u060C \u0645\u0628\u0644\u0645\u0627\u0646 \u06A9\u0645\u200C\u0627\u0631\u062A\u0641\u0627\u0639 \u0648 \u0631\u0646\u06AF\u200C\u0647\u0627\u06CC \u062E\u0627\u06A9\u06CC",
    colorPalette: [
      { name: "\u0627\u0633\u062A\u062E\u0648\u0627\u0646\u06CC \u06AF\u0631\u0645", hex: "#E8E0D1" },
      { name: "\u062E\u0627\u06A9 \u0631\u0633", hex: "#A88C73" },
      { name: "\u0628\u0644\u0648\u0637", hex: "#B49369" },
      { name: "\u0642\u0647\u0648\u0647\u200C\u0627\u06CC \u0633\u0648\u062E\u062A\u0647", hex: "#51443A" },
      { name: "\u0645\u0634\u06A9\u06CC \u0645\u0631\u06A9\u0628\u06CC", hex: "#252725" }
    ],
    materials: ["\u0686\u0648\u0628 \u0628\u0644\u0648\u0637 \u0648 \u06AF\u0631\u062F\u0648", "\u0628\u0627\u0645\u0628\u0648", "\u06A9\u062A\u0627\u0646", "\u0633\u0641\u0627\u0644 \u062F\u0633\u062A\u200C\u0633\u0627\u0632", "\u06A9\u0627\u063A\u0630 \u0648 \u062D\u0635\u06CC\u0631"],
    keyFeatures: ["\u06A9\u06CC\u0641\u06CC\u062A \u0628\u0647\u200C\u062C\u0627\u06CC \u062A\u0639\u062F\u0627\u062F", "\u0627\u0631\u062A\u0641\u0627\u0639 \u06A9\u0645 \u0645\u0628\u0644\u0645\u0627\u0646", "\u067E\u0630\u06CC\u0631\u0634 \u0646\u0627\u062A\u0645\u0627\u0645\u06CC \u0637\u0628\u06CC\u0639\u06CC", "\u062A\u0639\u0627\u062F\u0644 \u0631\u0648\u0634\u0646 \u0648 \u062A\u06CC\u0631\u0647"],
    furnitureCharacteristics: "\u0642\u0637\u0639\u0627\u062A \u06A9\u0645\u200C\u0627\u0631\u062A\u0641\u0627\u0639 \u0628\u0627 \u0627\u062A\u0635\u0627\u0644\u0627\u062A \u062F\u0642\u06CC\u0642\u060C \u0686\u0648\u0628 \u0637\u0628\u06CC\u0639\u06CC \u0648 \u0641\u0631\u0645 \u0622\u0631\u0627\u0645\u061B \u0647\u0631 \u0648\u0633\u06CC\u0644\u0647 \u0628\u0627\u06CC\u062F \u06A9\u0627\u0631\u0628\u0631\u062F \u0631\u0648\u0634\u0646 \u0648 \u06A9\u06CC\u0641\u06CC\u062A \u0633\u0627\u062E\u062A \u0642\u0627\u0628\u0644\u200C\u062F\u06CC\u062F\u0646 \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F.",
    lightingCharacteristics: "\u0646\u0648\u0631 \u0637\u0628\u06CC\u0639\u06CC \u0641\u06CC\u0644\u062A\u0631\u0634\u062F\u0647 \u0648 \u0686\u0631\u0627\u063A\u200C\u0647\u0627\u06CC \u06A9\u0627\u063A\u0630\u06CC \u06CC\u0627 \u0686\u0648\u0628\u06CC \u0628\u0627 \u0646\u0648\u0631 \u06AF\u0631\u0645\u061B \u0633\u0627\u06CC\u0647\u200C\u06CC \u0646\u0631\u0645 \u0628\u0647 \u062D\u0633 \u0633\u06A9\u0648\u0646 \u06A9\u0645\u06A9 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    formCharacteristics: "\u062E\u0637\u0648\u0637 \u0627\u0641\u0642\u06CC\u060C \u062A\u0646\u0627\u0633\u0628 \u06A9\u0645\u200C\u0627\u0631\u062A\u0641\u0627\u0639\u060C \u0641\u0631\u0645 \u0627\u0631\u06AF\u0627\u0646\u06CC\u06A9 \u0645\u062D\u062F\u0648\u062F \u0648 \u0639\u062F\u0645 \u062A\u0642\u0627\u0631\u0646 \u0633\u0646\u062C\u06CC\u062F\u0647.",
    decorCharacteristics: "\u0634\u0627\u062E\u0647\u200C\u06CC \u0645\u0646\u0641\u0631\u062F\u060C \u0633\u0641\u0627\u0644 \u0646\u0627\u0645\u062A\u0642\u0627\u0631\u0646\u060C \u062D\u0635\u06CC\u0631 \u0648 \u06CC\u06A9 \u0627\u062B\u0631 \u0647\u0646\u0631\u06CC \u0622\u0631\u0627\u0645\u061B \u0641\u0636\u0627\u06CC \u062E\u0627\u0644\u06CC \u0628\u062E\u0634 \u0641\u0639\u0627\u0644 \u0686\u06CC\u062F\u0645\u0627\u0646 \u0627\u0633\u062A.",
    visualDensity: "\u06A9\u0645\u061B \u0627\u0645\u0627 \u0628\u0627\u0641\u062A \u0648 \u062A\u0648\u0646\u0627\u0644\u06CC\u062A\u0647 \u0627\u0632 \u0633\u0631\u062F\u06CC \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644\u06CC\u0633\u0645 \u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    suitableFor: "\u0627\u0641\u0631\u0627\u062F\u06CC \u06A9\u0647 \u0622\u0631\u0627\u0645\u0634\u060C \u0635\u0646\u0639\u062A\u200C\u06AF\u0631\u06CC\u060C \u0645\u0648\u0627\u062F \u0637\u0628\u06CC\u0639\u06CC \u0648 \u062E\u0631\u06CC\u062F \u06A9\u0645\u062A\u0631 \u0627\u0645\u0627 \u0628\u0627\u06A9\u06CC\u0641\u06CC\u062A\u200C\u062A\u0631 \u0631\u0627 \u0627\u0631\u0632\u0634\u0645\u0646\u062F \u0645\u06CC\u200C\u062F\u0627\u0646\u0646\u062F.",
    suitableRooms: ["\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628", "\u0646\u0634\u06CC\u0645\u0646", "\u0641\u0636\u0627\u06CC \u0645\u0631\u0627\u0642\u0628\u0647", "\u062D\u0645\u0627\u0645"],
    comparisonNote: "\u0698\u0627\u067E\u0646\u062F\u06CC \u0627\u0632 \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644 \u0628\u0627\u0641\u062A\u200C\u062F\u0627\u0631\u062A\u0631 \u0648 \u0627\u0632 \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC \u06A9\u0645\u200C\u0627\u0631\u062A\u0641\u0627\u0639\u200C\u062A\u0631 \u0648 \u062E\u0644\u0648\u062A\u200C\u062A\u0631 \u0627\u0633\u062A\u061B \u06A9\u0646\u062A\u0631\u0627\u0633\u062A \u0686\u0648\u0628 \u062A\u06CC\u0631\u0647 \u0648 \u0645\u0641\u0647\u0648\u0645 \u0648\u0627\u0628\u06CC\u200C\u0633\u0627\u0628\u06CC \u062A\u0641\u0627\u0648\u062A \u0627\u0635\u0644\u06CC \u0622\u0646 \u0627\u0633\u062A."
  },
  {
    id: "style-classic",
    slug: "classic",
    name: "\u06A9\u0644\u0627\u0633\u06CC\u06A9",
    nameEn: "Classic",
    tagline: " elegance \u062C\u0627\u0648\u062F\u0627\u0646\u0647",
    shortDescription: "\u0686\u06CC\u062F\u0645\u0627\u0646\u06CC \u0645\u062A\u0642\u0627\u0631\u0646 \u0628\u0627 \u0686\u0648\u0628\u200C\u0647\u0627\u06CC \u0627\u0635\u06CC\u0644\u060C \u067E\u0627\u0631\u0686\u0647\u200C\u0647\u0627\u06CC \u063A\u0646\u06CC \u0648 \u062C\u0632\u0626\u06CC\u0627\u062A \u0645\u0639\u0645\u0627\u0631\u06CC \u06A9\u0647 \u0627\u0632 \u0633\u0646\u062A\u200C\u0647\u0627\u06CC \u0627\u0631\u0648\u067E\u0627\u06CC\u06CC \u0627\u0644\u0647\u0627\u0645 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F.",
    description: "\u0633\u0628\u06A9 \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0628\u0631 \u062A\u0646\u0627\u0633\u0628\u060C \u0645\u062D\u0648\u0631\u0647\u0627\u06CC \u062F\u06CC\u062F \u0648 \u062A\u0642\u0627\u0631\u0646 \u0627\u0633\u062A\u0648\u0627\u0631 \u0627\u0633\u062A. \u0642\u0627\u0628\u200C\u0628\u0646\u062F\u06CC \u062F\u06CC\u0648\u0627\u0631\u060C \u0645\u0628\u0644\u0645\u0627\u0646 \u062E\u0648\u0634\u200C\u0633\u0627\u062E\u062A\u060C \u0622\u062B\u0627\u0631 \u0647\u0646\u0631\u06CC \u0648 \u067E\u0627\u0631\u0686\u0647\u200C\u0647\u0627\u06CC \u0628\u0627\u06A9\u06CC\u0641\u06CC\u062A \u062F\u0631 \u06A9\u0646\u0627\u0631 \u0647\u0645 \u0641\u0636\u0627\u06CC\u06CC \u0631\u0633\u0645\u06CC \u0627\u0645\u0627 \u06AF\u0631\u0645 \u0645\u06CC\u200C\u0633\u0627\u0632\u0646\u062F. \u06A9\u06CC\u0641\u06CC\u062A \u0648 \u067E\u06CC\u0648\u0633\u062A\u06AF\u06CC \u0645\u0647\u0645\u200C\u062A\u0631 \u0627\u0632 \u0632\u0631\u0642\u200C\u0648\u0628\u0631\u0642 \u0627\u0633\u062A\u061B \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u062E\u0648\u0628\u060C \u0645\u062C\u0645\u0648\u0639\u0647\u200C\u0627\u06CC \u062A\u0635\u0627\u062F\u0641\u06CC \u0627\u0632 \u0648\u0633\u0627\u06CC\u0644 \u067E\u0631\u06A9\u0627\u0631 \u0646\u06CC\u0633\u062A.",
    image: IMG.styleClassic,
    imageAlt: "\u0641\u0636\u0627\u06CC \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0628\u0627 \u0645\u0628\u0644\u0645\u0627\u0646 \u0686\u0648\u0628\u06CC\u060C \u062A\u0642\u0627\u0631\u0646 \u0648 \u062C\u0632\u0626\u06CC\u0627\u062A \u0645\u0639\u0645\u0627\u0631\u06CC",
    colorPalette: [
      { name: "\u06A9\u0631\u0645 \u0639\u0627\u062C\u06CC", hex: "#EADFCB" },
      { name: "\u06AF\u0631\u062F\u0648\u06CC\u06CC", hex: "#725039" },
      { name: "\u0633\u0628\u0632 \u0632\u06CC\u062A\u0648\u0646\u06CC", hex: "#66705A" },
      { name: "\u0632\u0631\u0634\u06A9\u06CC", hex: "#70404A" },
      { name: "\u0628\u0631\u0646\u0632", hex: "#A47E45" }
    ],
    materials: ["\u0686\u0648\u0628 \u06AF\u0631\u062F\u0648 \u0648 \u0645\u0627\u0647\u0648\u0646", "\u0633\u0646\u06AF \u0637\u0628\u06CC\u0639\u06CC", "\u0645\u062E\u0645\u0644", "\u0627\u0628\u0631\u06CC\u0634\u0645", "\u0628\u0631\u0646\u0632"],
    keyFeatures: ["\u062A\u0642\u0627\u0631\u0646 \u0648 \u0645\u062D\u0648\u0631 \u0645\u0631\u06A9\u0632\u06CC", "\u0642\u0627\u0628\u200C\u0628\u0646\u062F\u06CC \u0645\u0639\u0645\u0627\u0631\u06CC", "\u06A9\u06CC\u0641\u06CC\u062A \u0633\u0627\u062E\u062A \u0628\u0627\u0644\u0627", "\u0644\u0627\u06CC\u0647\u200C\u0628\u0646\u062F\u06CC \u067E\u0627\u0631\u0686\u0647 \u0648 \u0647\u0646\u0631"],
    furnitureCharacteristics: "\u0645\u0628\u0644\u0645\u0627\u0646 \u0628\u0627 \u062A\u0646\u0627\u0633\u0628 \u0631\u0633\u0645\u06CC\u060C \u062F\u0633\u062A\u0647\u200C\u0647\u0627\u06CC \u0645\u0646\u062D\u0646\u06CC\u060C \u067E\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u062A\u0631\u0627\u0634\u200C\u062E\u0648\u0631\u062F\u0647 \u0648 \u0631\u0648\u06A9\u0634\u200C\u0647\u0627\u06CC \u0628\u0627\u062F\u0648\u0627\u0645\u061B \u0633\u062A\u200C\u06A9\u0631\u062F\u0646 \u06A9\u0627\u0645\u0644 \u0644\u0627\u0632\u0645 \u0646\u06CC\u0633\u062A \u0627\u0645\u0627 \u0632\u0628\u0627\u0646 \u0641\u0631\u0645\u06CC \u0628\u0627\u06CC\u062F \u0647\u0645\u0627\u0647\u0646\u06AF \u0628\u0627\u0634\u062F.",
    lightingCharacteristics: "\u0644\u0648\u0633\u062A\u0631 \u0645\u0631\u06A9\u0632\u06CC \u062F\u0631 \u06A9\u0646\u0627\u0631 \u062F\u06CC\u0648\u0627\u0631\u06A9\u0648\u0628 \u0648 \u0622\u0628\u0627\u0698\u0648\u0631\u0647\u0627\u06CC \u0645\u062A\u0642\u0627\u0631\u0646\u061B \u0646\u0648\u0631 \u06AF\u0631\u0645 \u0628\u0631\u0627\u06CC \u0646\u0645\u0627\u06CC\u0634 \u0639\u0645\u0642 \u0686\u0648\u0628 \u0648 \u067E\u0627\u0631\u0686\u0647.",
    formCharacteristics: "\u062A\u0639\u0627\u062F\u0644 \u0645\u062D\u0648\u0631\u06CC\u060C \u0645\u0646\u062D\u0646\u06CC\u200C\u0647\u0627\u06CC \u06A9\u0646\u062A\u0631\u0644\u200C\u0634\u062F\u0647 \u0648 \u062A\u0646\u0627\u0633\u0628\u200C\u0647\u0627\u06CC \u0627\u0644\u0647\u0627\u0645\u200C\u06AF\u0631\u0641\u062A\u0647 \u0627\u0632 \u0645\u0639\u0645\u0627\u0631\u06CC \u0633\u0646\u062A\u06CC.",
    decorCharacteristics: "\u0622\u06CC\u0646\u0647 \u0642\u0627\u0628\u200C\u062F\u0627\u0631\u060C \u062A\u0627\u0628\u0644\u0648\u060C \u06A9\u062A\u0627\u0628\u060C \u0638\u0631\u0648\u0641 \u0686\u06CC\u0646\u06CC \u0648 \u0641\u0631\u0634 \u0646\u0642\u0634\u200C\u062F\u0627\u0631\u061B \u0647\u0631 \u06AF\u0631\u0648\u0647 \u0628\u0627 \u0646\u0638\u0645 \u0648 \u0641\u0627\u0635\u0644\u0647\u200C\u06CC \u0645\u0646\u0627\u0633\u0628 \u0686\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.",
    visualDensity: "\u0645\u062A\u0648\u0633\u0637 \u062A\u0627 \u0632\u06CC\u0627\u062F\u060C \u0627\u0645\u0627 \u0633\u0627\u0632\u0645\u0627\u0646\u200C\u06CC\u0627\u0641\u062A\u0647 \u0648 \u0645\u062A\u0642\u0627\u0631\u0646.",
    suitableFor: "\u0627\u0641\u0631\u0627\u062F\u06CC \u06A9\u0647 \u0627\u0635\u0627\u0644\u062A\u060C \u062C\u0632\u0626\u06CC\u0627\u062A \u0647\u0646\u0631\u06CC \u0648 \u0641\u0636\u0627\u06CC \u0631\u0633\u0645\u06CC\u0650 \u06AF\u0631\u0645 \u0631\u0627 \u0628\u0647 \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u0633\u0631\u06CC\u0639 \u062A\u0631\u0646\u062F \u062A\u0631\u062C\u06CC\u062D \u0645\u06CC\u200C\u062F\u0647\u0646\u062F.",
    suitableRooms: ["\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", "\u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC \u0631\u0633\u0645\u06CC", "\u06A9\u062A\u0627\u0628\u062E\u0627\u0646\u0647", "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628 \u0627\u0635\u0644\u06CC"],
    comparisonNote: "\u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0628\u0647 \u0633\u0646\u062A \u0648 \u062C\u0632\u0626\u06CC\u0627\u062A \u062A\u0627\u0631\u06CC\u062E\u06CC \u0648\u0641\u0627\u062F\u0627\u0631\u062A\u0631 \u0627\u0633\u062A\u061B \u0646\u0626\u0648\u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0647\u0645\u0627\u0646 \u0646\u0638\u0645 \u0648 \u062A\u0642\u0627\u0631\u0646 \u0631\u0627 \u0628\u0627 \u062E\u0637\u0648\u0637 \u0633\u0628\u06A9\u200C\u062A\u0631\u060C \u0631\u0646\u06AF\u200C\u0647\u0627\u06CC \u0622\u0631\u0627\u0645\u200C\u062A\u0631 \u0648 \u062A\u0632\u0626\u06CC\u0646 \u06A9\u0645\u062A\u0631 \u0628\u0627\u0632\u062E\u0648\u0627\u0646\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F."
  },
  {
    id: "style-neoclassical",
    slug: "neoclassical",
    name: "\u0646\u0626\u0648\u06A9\u0644\u0627\u0633\u06CC\u06A9",
    nameEn: "Neoclassical",
    tagline: "\u0648\u0642\u0627\u0631 \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0628\u0627 \u062A\u0646\u0641\u0633 \u0627\u0645\u0631\u0648\u0632\u06CC",
    shortDescription: "\u062A\u0642\u0627\u0631\u0646 \u0648 \u0638\u0631\u0627\u0641\u062A \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u062F\u0631 \u067E\u0648\u0633\u062A\u0647\u200C\u0627\u06CC \u0631\u0648\u0634\u0646\u200C\u062A\u0631 \u0648 \u06A9\u0645\u200C\u062C\u0632\u0626\u06CC\u0627\u062A\u200C\u062A\u0631\u061B \u0645\u0646\u0627\u0633\u0628 \u062E\u0627\u0646\u0647\u200C\u0647\u0627\u06CC\u06CC \u06A9\u0647 \u0631\u0633\u0645\u06CC\u062A \u0631\u0627 \u0628\u062F\u0648\u0646 \u0633\u0646\u06AF\u06CC\u0646\u06CC \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0646\u062F.",
    description: "\u0646\u0626\u0648\u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0627\u0632 \u0627\u0635\u0648\u0644 \u06A9\u0644\u0627\u0633\u06CC\u06A9\u2014\u062A\u0642\u0627\u0631\u0646\u060C \u062A\u0646\u0627\u0633\u0628 \u0648 \u0642\u0627\u0628\u200C\u0628\u0646\u062F\u06CC\u2014\u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F\u060C \u0627\u0645\u0627 \u062A\u0632\u0626\u06CC\u0646\u0627\u062A \u0631\u0627 \u067E\u0627\u0644\u0627\u06CC\u0634 \u0648 \u067E\u0627\u0644\u062A \u0631\u0627 \u0631\u0648\u0634\u0646 \u0645\u06CC\u200C\u06A9\u0646\u062F. \u062F\u06CC\u0648\u0627\u0631\u0647\u0627\u06CC \u0627\u0628\u0632\u0627\u0631\u062E\u0648\u0631\u062F\u0647\u200C\u06CC \u0638\u0631\u06CC\u0641\u060C \u0645\u0628\u0644\u0645\u0627\u0646 \u062E\u0648\u0634\u200C\u0641\u0631\u0645 \u0648 \u0641\u0644\u0632\u0627\u062A \u06AF\u0631\u0645 \u062F\u0631 \u06A9\u0646\u0627\u0631 \u0633\u0637\u0648\u062D \u0633\u0627\u062F\u0647 \u0642\u0631\u0627\u0631 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u0646\u062F \u062A\u0627 \u0641\u0636\u0627 \u0645\u062C\u0644\u0644 \u0628\u0627\u0634\u062F\u060C \u0646\u0647 \u0634\u0644\u0648\u063A.",
    image: IMG.styleNeoclassical,
    imageAlt: "\u0627\u062A\u0627\u0642 \u0646\u0626\u0648\u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0631\u0648\u0634\u0646 \u0628\u0627 \u0642\u0627\u0628\u200C\u0628\u0646\u062F\u06CC \u0638\u0631\u06CC\u0641 \u0648 \u0645\u0628\u0644\u0645\u0627\u0646 \u0645\u0639\u0627\u0635\u0631",
    colorPalette: [
      { name: "\u0627\u0633\u062A\u062E\u0648\u0627\u0646\u06CC", hex: "#EEE7DA" },
      { name: "\u06AF\u0631\u06CC\u0698", hex: "#BDB3A5" },
      { name: "\u062A\u0627\u067E", hex: "#8D7D6F" },
      { name: "\u0622\u0628\u06CC \u062F\u0648\u062F\u06CC", hex: "#667583" },
      { name: "\u0637\u0644\u0627\u06CC\u06CC \u0645\u0627\u062A", hex: "#B79A63" }
    ],
    materials: ["\u0633\u0646\u06AF \u0645\u0631\u0645\u0631", "\u0686\u0648\u0628 \u0631\u0646\u06AF\u200C\u0634\u062F\u0647", "\u0645\u062E\u0645\u0644 \u0633\u0627\u062F\u0647", "\u0628\u0631\u0646\u062C \u0645\u0627\u062A", "\u06AF\u0686\u200C\u0628\u0631\u06CC \u0638\u0631\u06CC\u0641"],
    keyFeatures: ["\u062A\u0642\u0627\u0631\u0646 \u0633\u0628\u06A9\u200C\u0634\u062F\u0647", "\u0642\u0627\u0628\u200C\u0628\u0646\u062F\u06CC \u0638\u0631\u06CC\u0641 \u062F\u06CC\u0648\u0627\u0631", "\u067E\u0627\u0644\u062A \u062E\u0646\u062B\u06CC \u0644\u0627\u06CC\u0647\u200C\u062F\u0627\u0631", "\u0646\u0642\u0637\u0647\u200C\u0647\u0627\u06CC \u0641\u0644\u0632\u06CC \u06AF\u0631\u0645"],
    furnitureCharacteristics: "\u0641\u0631\u0645\u200C\u0647\u0627\u06CC \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0633\u0627\u062F\u0647\u200C\u0634\u062F\u0647 \u0628\u0627 \u067E\u0627\u0631\u0686\u0647\u200C\u0647\u0627\u06CC \u06CC\u06A9\u062F\u0633\u062A\u060C \u067E\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u0638\u0631\u06CC\u0641 \u0648 \u0627\u0628\u0639\u0627\u062F \u0645\u062A\u0646\u0627\u0633\u0628\u061B \u06CC\u06A9 \u0642\u0637\u0639\u0647\u200C\u06CC \u0645\u0639\u0627\u0635\u0631 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u062A\u0639\u0627\u062F\u0644 \u0641\u0636\u0627 \u0631\u0627 \u062A\u0627\u0632\u0647 \u06A9\u0646\u062F.",
    lightingCharacteristics: "\u0644\u0648\u0633\u062A\u0631 \u06CC\u0627 \u0622\u0648\u06CC\u0632 \u0634\u0627\u062E\u0635 \u0628\u0627 \u0641\u0631\u0645 \u0633\u0627\u062F\u0647\u060C \u062F\u06CC\u0648\u0627\u0631\u06A9\u0648\u0628\u200C\u0647\u0627\u06CC \u062C\u0641\u062A \u0648 \u0646\u0648\u0631 \u0645\u062E\u0641\u06CC \u0628\u0631\u0627\u06CC \u0628\u0631\u062C\u0633\u062A\u0647\u200C\u06A9\u0631\u062F\u0646 \u0642\u0627\u0628\u200C\u0647\u0627\u06CC \u0645\u0639\u0645\u0627\u0631\u06CC.",
    formCharacteristics: "\u062A\u0642\u0627\u0631\u0646\u060C \u0642\u0627\u0628\u200C\u0647\u0627\u06CC \u0645\u0633\u062A\u0637\u06CC\u0644\u06CC \u06A9\u0634\u06CC\u062F\u0647 \u0648 \u0645\u0646\u062D\u0646\u06CC\u200C\u0647\u0627\u06CC \u0645\u062D\u062F\u0648\u062F\u061B \u062C\u0632\u0626\u06CC\u0627\u062A \u06A9\u0645\u200C\u0639\u0645\u0642 \u0648 \u062F\u0642\u06CC\u0642\u200C\u0627\u0646\u062F.",
    decorCharacteristics: "\u0622\u06CC\u0646\u0647 \u0628\u0632\u0631\u06AF\u060C \u0645\u062C\u0633\u0645\u0647 \u06CC\u0627 \u06AF\u0644\u062F\u0627\u0646 \u0645\u062D\u062F\u0648\u062F\u060C \u067E\u0631\u062F\u0647\u200C\u0647\u0627\u06CC \u0628\u0644\u0646\u062F \u0648 \u0622\u062B\u0627\u0631 \u0647\u0646\u0631\u06CC \u0628\u0627 \u0642\u0627\u0628 \u0633\u0627\u062F\u0647\u061B \u0627\u0632 \u062A\u0632\u0626\u06CC\u0646 \u0631\u06CC\u0632 \u0648 \u067E\u0631\u062A\u0639\u062F\u0627\u062F \u067E\u0631\u0647\u06CC\u0632 \u0645\u06CC\u200C\u0634\u0648\u062F.",
    visualDensity: "\u0645\u062A\u0648\u0633\u0637\u061B \u0641\u0636\u0627\u06CC \u062A\u0646\u0641\u0633 \u0645\u06CC\u0627\u0646 \u0639\u0646\u0627\u0635\u0631 \u0631\u0633\u0645\u06CC \u062D\u0641\u0638 \u0645\u06CC\u200C\u0634\u0648\u062F.",
    suitableFor: "\u06A9\u0633\u0627\u0646\u06CC \u06A9\u0647 \u0638\u0631\u0627\u0641\u062A \u0648 \u062D\u0633 \u0644\u0648\u06A9\u0633 \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0631\u0627 \u0645\u06CC\u200C\u067E\u0633\u0646\u062F\u0646\u062F \u0627\u0645\u0627 \u062E\u0627\u0646\u0647\u200C\u0627\u06CC \u0631\u0648\u0634\u0646\u060C \u0627\u0645\u0631\u0648\u0632\u06CC \u0648 \u06A9\u0645\u200C\u0627\u0632\u062F\u062D\u0627\u0645 \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0646\u062F.",
    suitableRooms: ["\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628 \u0627\u0635\u0644\u06CC", "\u0648\u0631\u0648\u062F\u06CC", "\u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC"],
    comparisonNote: "\u0646\u0626\u0648\u06A9\u0644\u0627\u0633\u06CC\u06A9 \u062A\u0632\u0626\u06CC\u0646\u0627\u062A \u0631\u0627 \u0627\u0632 \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u06A9\u0645\u062A\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F\u060C \u0627\u0645\u0627 \u0628\u0631\u062E\u0644\u0627\u0641 \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644 \u0647\u0645\u0686\u0646\u0627\u0646 \u0628\u0631 \u062A\u0642\u0627\u0631\u0646\u060C \u0642\u0627\u0628\u200C\u0628\u0646\u062F\u06CC \u0648 \u0627\u0631\u062C\u0627\u0639 \u062A\u0627\u0631\u06CC\u062E\u06CC \u062A\u06A9\u06CC\u0647 \u062F\u0627\u0631\u062F."
  },
  {
    id: "style-industrial",
    slug: "industrial",
    name: "\u0635\u0646\u0639\u062A\u06CC",
    nameEn: "Industrial",
    tagline: "\u0633\u0627\u0632\u0647\u200C\u06CC \u0639\u0631\u06CC\u0627\u0646\u060C \u0628\u0627\u0641\u062A \u0648\u0627\u0642\u0639\u06CC\u060C \u0634\u062E\u0635\u06CC\u062A \u0634\u0647\u0631\u06CC",
    shortDescription: "\u0622\u062C\u0631\u060C \u0628\u062A\u0646\u060C \u0641\u0644\u0632 \u062A\u06CC\u0631\u0647 \u0648 \u0686\u0648\u0628 \u0628\u0627\u0632\u06CC\u0627\u0641\u062A\u06CC \u062F\u0631 \u0641\u0636\u0627\u06CC\u06CC \u0628\u0627\u0632 \u06A9\u0647 \u0627\u062C\u0632\u0627\u06CC \u0633\u0627\u0632\u0647 \u0648 \u062A\u0623\u0633\u06CC\u0633\u0627\u062A \u0631\u0627 \u067E\u0646\u0647\u0627\u0646 \u0646\u0645\u06CC\u200C\u06A9\u0646\u062F.",
    description: "\u0633\u0628\u06A9 \u0635\u0646\u0639\u062A\u06CC \u0627\u0632 \u062A\u0628\u062F\u06CC\u0644 \u06A9\u0627\u0631\u062E\u0627\u0646\u0647\u200C\u0647\u0627 \u0648 \u0627\u0646\u0628\u0627\u0631\u0647\u0627\u06CC \u0642\u062F\u06CC\u0645\u06CC \u0628\u0647 \u0641\u0636\u0627\u06CC \u0632\u0646\u062F\u06AF\u06CC \u0634\u06A9\u0644 \u06AF\u0631\u0641\u062A. \u062F\u06CC\u0648\u0627\u0631 \u0622\u062C\u0631\u06CC\u060C \u0628\u062A\u0646\u060C \u062A\u06CC\u0631 \u0648 \u0644\u0648\u0644\u0647\u200C\u06CC \u0646\u0645\u0627\u06CC\u0627\u0646 \u0628\u062E\u0634\u06CC \u0627\u0632 \u0632\u0628\u0627\u0646 \u0622\u0646 \u0627\u0633\u062A\u060C \u0627\u0645\u0627 \u0628\u0631\u0627\u06CC \u0642\u0627\u0628\u0644\u200C\u0632\u0646\u062F\u06AF\u06CC\u200C\u0634\u062F\u0646 \u0628\u0647 \u0686\u0648\u0628 \u06AF\u0631\u0645\u060C \u0686\u0631\u0645 \u0648 \u0646\u0648\u0631 \u0644\u0627\u06CC\u0647\u200C\u0627\u06CC \u0646\u06CC\u0627\u0632 \u062F\u0627\u0631\u062F. \u0635\u0646\u0639\u062A\u06CC \u0645\u0648\u0641\u0642 \u062E\u0634\u0646 \u0627\u0633\u062A\u060C \u0646\u0647 \u0633\u0631\u062F \u0648 \u0646\u0627\u062A\u0645\u0627\u0645.",
    image: IMG.styleIndustrial,
    imageAlt: "\u0646\u0634\u06CC\u0645\u0646 \u0635\u0646\u0639\u062A\u06CC \u0628\u0627 \u062F\u06CC\u0648\u0627\u0631 \u0622\u062C\u0631\u06CC\u060C \u0641\u0644\u0632 \u062A\u06CC\u0631\u0647 \u0648 \u067E\u0644\u0627\u0646 \u0628\u0627\u0632",
    colorPalette: [
      { name: "\u0630\u063A\u0627\u0644\u06CC", hex: "#282C2C" },
      { name: "\u062E\u0627\u06A9\u0633\u062A\u0631\u06CC \u0628\u062A\u0646", hex: "#858681" },
      { name: "\u0622\u062C\u0631\u06CC", hex: "#9A5842" },
      { name: "\u0642\u0647\u0648\u0647\u200C\u0627\u06CC \u0686\u0631\u0645", hex: "#744C32" },
      { name: "\u06A9\u0631\u0645 \u0686\u0631\u06A9", hex: "#D8CFBF" }
    ],
    materials: ["\u0622\u062C\u0631", "\u0628\u062A\u0646", "\u0641\u0648\u0644\u0627\u062F \u0633\u06CC\u0627\u0647", "\u0686\u0648\u0628 \u0628\u0627\u0632\u06CC\u0627\u0641\u062A\u06CC", "\u0686\u0631\u0645"],
    keyFeatures: ["\u0646\u0645\u0627\u06CC\u0634 \u0633\u0627\u0632\u0647 \u0648 \u0627\u062A\u0635\u0627\u0644\u0627\u062A", "\u067E\u0644\u0627\u0646 \u0628\u0627\u0632", "\u0633\u0637\u0648\u062D \u067E\u062A\u06CC\u0646\u0647\u200C\u062F\u0627\u0631", "\u062A\u0631\u06A9\u06CC\u0628 \u0628\u0627\u0641\u062A \u0633\u0631\u062F \u0648 \u06AF\u0631\u0645"],
    furnitureCharacteristics: "\u0642\u0637\u0639\u0627\u062A \u0645\u062D\u06A9\u0645 \u0628\u0627 \u0627\u0633\u06A9\u0644\u062A \u0641\u0644\u0632\u06CC\u060C \u0686\u0631\u0645 \u06A9\u0647\u0646\u0647\u200C\u0646\u0645\u0627 \u0648 \u0686\u0648\u0628 \u0636\u062E\u06CC\u0645\u061B \u0641\u0631\u0645\u200C\u0647\u0627 \u0633\u0627\u062F\u0647 \u0648 \u0645\u0642\u06CC\u0627\u0633 \u06A9\u0645\u06CC \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0633\u062A.",
    lightingCharacteristics: "\u0622\u0648\u06CC\u0632\u0647\u0627\u06CC \u0641\u0644\u0632\u06CC\u060C \u0686\u0631\u0627\u063A \u0631\u06CC\u0644\u06CC \u0648 \u0644\u0627\u0645\u067E\u200C\u0647\u0627\u06CC \u06AF\u0631\u0645\u061B \u0686\u0646\u062F \u0645\u0646\u0628\u0639 \u06A9\u0645\u200C\u0627\u0631\u062A\u0641\u0627\u0639 \u0627\u0632 \u062D\u0633 \u0633\u0631\u062F \u0627\u0646\u0628\u0627\u0631 \u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    formCharacteristics: "\u0647\u0646\u062F\u0633\u0647\u200C\u06CC \u0635\u0631\u06CC\u062D\u060C \u0634\u0628\u06A9\u0647\u200C\u0647\u0627\u06CC \u0641\u0644\u0632\u06CC\u060C \u062D\u062C\u0645\u200C\u0647\u0627\u06CC \u0628\u0632\u0631\u06AF \u0648 \u0627\u062A\u0635\u0627\u0644\u0627\u062A \u0642\u0627\u0628\u0644\u200C\u0645\u0634\u0627\u0647\u062F\u0647.",
    decorCharacteristics: "\u067E\u0648\u0633\u062A\u0631 \u06AF\u0631\u0627\u0641\u06CC\u06A9\u06CC\u060C \u0633\u0627\u0639\u062A \u0628\u0632\u0631\u06AF\u060C \u0627\u0634\u06CC\u0627\u06CC \u06A9\u0627\u0631\u06AF\u0627\u0647\u06CC \u0648 \u06AF\u06CC\u0627\u0647\u0627\u0646 \u0645\u0642\u0627\u0648\u0645\u061B \u062A\u0632\u0626\u06CC\u0646\u0627\u062A \u0628\u0627\u06CC\u062F \u0628\u0627 \u0645\u0642\u06CC\u0627\u0633 \u0641\u0636\u0627 \u0647\u0645\u0627\u0647\u0646\u06AF \u0628\u0627\u0634\u0646\u062F.",
    visualDensity: "\u0645\u062A\u0648\u0633\u0637\u061B \u0628\u0627\u0641\u062A \u0633\u0637\u0648\u062D \u0632\u06CC\u0627\u062F \u0627\u0633\u062A\u060C \u067E\u0633 \u062A\u0639\u062F\u0627\u062F \u0627\u06A9\u0633\u0633\u0648\u0631\u06CC \u0628\u0647\u062A\u0631 \u0627\u0633\u062A \u0645\u062D\u062F\u0648\u062F \u0628\u0645\u0627\u0646\u062F.",
    suitableFor: "\u0627\u0641\u0631\u0627\u062F\u06CC \u06A9\u0647 \u0641\u0636\u0627\u0647\u0627\u06CC \u0634\u0647\u0631\u06CC\u060C \u0645\u062A\u0631\u06CC\u0627\u0644 \u0628\u06CC\u200C\u067E\u06CC\u0631\u0627\u06CC\u0647 \u0648 \u062F\u06A9\u0648\u0631 \u062C\u0633\u0648\u0631 \u0628\u0627 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0622\u0633\u0627\u0646 \u0631\u0627 \u062F\u0648\u0633\u062A \u062F\u0627\u0631\u0646\u062F.",
    suitableRooms: ["\u0646\u0634\u06CC\u0645\u0646 \u067E\u0644\u0627\u0646 \u0628\u0627\u0632", "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631", "\u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647", "\u06A9\u0627\u0641\u0647 \u06CC\u0627 \u0627\u0633\u062A\u0648\u062F\u06CC\u0648 \u062E\u0627\u0646\u06AF\u06CC"],
    comparisonNote: "\u0631\u0648\u0633\u062A\u06CC\u06A9 \u0647\u0645 \u0645\u0648\u0627\u062F \u062E\u0627\u0645 \u062F\u0627\u0631\u062F\u060C \u0627\u0645\u0627 \u0631\u06CC\u0634\u0647\u200C\u0627\u0634 \u0637\u0628\u06CC\u0639\u062A \u0648 \u0632\u0646\u062F\u06AF\u06CC \u0631\u0648\u0633\u062A\u0627\u06CC\u06CC \u0627\u0633\u062A\u061B \u0635\u0646\u0639\u062A\u06CC \u0628\u0631 \u0633\u0627\u0632\u0647\u060C \u0641\u0644\u0632 \u0648 \u0645\u06CC\u0631\u0627\u062B \u06A9\u0627\u0631\u062E\u0627\u0646\u0647\u200C\u0627\u06CC \u062A\u0623\u06A9\u06CC\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F."
  },
  {
    id: "style-boho",
    slug: "boho",
    name: "\u0628\u0648\u0647\u0648",
    nameEn: "Boho",
    tagline: "\u0644\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u0622\u0632\u0627\u062F\u060C \u0628\u0627\u0641\u062A \u062F\u0633\u062A\u200C\u0633\u0627\u0632\u060C \u0642\u0635\u0647\u200C\u0647\u0627\u06CC \u0634\u062E\u0635\u06CC",
    shortDescription: "\u062A\u0631\u06A9\u06CC\u0628\u06CC \u0622\u0632\u0627\u062F \u0627\u0632 \u0645\u0646\u0633\u0648\u062C\u0627\u062A\u060C \u06AF\u06CC\u0627\u0647\u0627\u0646\u060C \u0635\u0646\u0627\u06CC\u0639\u200C\u062F\u0633\u062A\u06CC \u0648 \u06CC\u0627\u062F\u06AF\u0627\u0631\u06CC\u200C\u0647\u0627\u06CC \u0633\u0641\u0631 \u06A9\u0647 \u0628\u0627 \u06CC\u06A9 \u067E\u0627\u0644\u062A \u067E\u0627\u06CC\u0647\u200C\u06CC \u0645\u0646\u0633\u062C\u0645 \u0627\u0632 \u0622\u0634\u0641\u062A\u06AF\u06CC \u062F\u0648\u0631 \u0645\u06CC\u200C\u0645\u0627\u0646\u062F.",
    description: "\u0628\u0648\u0647\u0648 \u06CC\u0627 \u0628\u0648\u0647\u0645\u06CC\u0646 \u0627\u0632 \u0628\u06CC\u0627\u0646 \u0634\u062E\u0635\u06CC \u0648 \u0641\u0631\u0647\u0646\u06AF\u200C\u0647\u0627\u06CC \u06AF\u0648\u0646\u0627\u06AF\u0648\u0646 \u062A\u063A\u0630\u06CC\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F. \u0627\u0644\u06AF\u0648\u060C \u0631\u0646\u06AF \u0648 \u0628\u0627\u0641\u062A \u062F\u0631 \u0622\u0646 \u0641\u0631\u0627\u0648\u0627\u0646 \u0627\u0633\u062A\u060C \u0627\u0645\u0627 \u0646\u062A\u06CC\u062C\u0647\u200C\u06CC \u062D\u0631\u0641\u0647\u200C\u0627\u06CC \u0628\u0647 \u06CC\u06A9 \u0631\u0646\u06AF \u0632\u0645\u06CC\u0646\u0647\u200C\u06CC \u0622\u0631\u0627\u0645 \u0648 \u062A\u06A9\u0631\u0627\u0631 \u062D\u0633\u0627\u0628\u200C\u0634\u062F\u0647\u200C\u06CC \u0686\u0646\u062F \u0631\u0646\u06AF \u0646\u06CC\u0627\u0632 \u062F\u0627\u0631\u062F. \u062F\u0633\u062A\u200C\u0633\u0627\u0632\u0628\u0648\u062F\u0646 \u0648 \u062F\u0627\u0633\u062A\u0627\u0646 \u0647\u0631 \u0634\u06CC\u0621 \u0627\u0632 \u0647\u0645\u0627\u0647\u0646\u06AF\u06CC \u0633\u062A\u200C\u0645\u0627\u0646\u0646\u062F \u0645\u0647\u0645\u200C\u062A\u0631 \u0627\u0633\u062A.",
    image: IMG.styleBoho,
    imageAlt: "\u0641\u0636\u0627\u06CC \u0628\u0648\u0647\u0648 \u0628\u0627 \u062D\u0635\u06CC\u0631\u060C \u0645\u0646\u0633\u0648\u062C\u0627\u062A \u0637\u0631\u062D\u200C\u062F\u0627\u0631\u060C \u06AF\u06CC\u0627\u0647 \u0648 \u0631\u0646\u06AF\u200C\u0647\u0627\u06CC \u06AF\u0631\u0645",
    colorPalette: [
      { name: "\u06A9\u0631\u0645 \u062E\u0627\u06A9\u06CC", hex: "#E7D8C1" },
      { name: "\u062A\u0631\u0627\u06A9\u0648\u062A\u0627", hex: "#B76445" },
      { name: "\u062E\u0631\u062F\u0644\u06CC", hex: "#B98A3D" },
      { name: "\u0633\u0628\u0632 \u062C\u0646\u06AF\u0644\u06CC", hex: "#49604B" },
      { name: "\u0622\u0644\u0648\u06CC\u06CC", hex: "#674555" }
    ],
    materials: ["\u062D\u0635\u06CC\u0631 \u0648 \u0631\u0627\u062A\u0627\u0646", "\u067E\u0646\u0628\u0647", "\u062C\u0648\u062A", "\u0686\u0648\u0628", "\u0633\u0631\u0627\u0645\u06CC\u06A9 \u062F\u0633\u062A\u200C\u0633\u0627\u0632"],
    keyFeatures: ["\u0644\u0627\u06CC\u0647\u200C\u0628\u0646\u062F\u06CC \u0627\u0644\u06AF\u0648 \u0648 \u0628\u0627\u0641\u062A", "\u0627\u0634\u06CC\u0627\u06CC \u0634\u062E\u0635\u06CC \u0648 \u0633\u0641\u0631", "\u06AF\u06CC\u0627\u0647\u0627\u0646 \u0641\u0631\u0627\u0648\u0627\u0646", "\u062A\u0631\u06A9\u06CC\u0628 \u0622\u0632\u0627\u062F \u0642\u062F\u06CC\u0645 \u0648 \u062C\u062F\u06CC\u062F"],
    furnitureCharacteristics: "\u0646\u0634\u06CC\u0645\u0646\u200C\u0647\u0627\u06CC \u0631\u0627\u062D\u062A \u0648 \u06A9\u0645\u200C\u0627\u0631\u062A\u0641\u0627\u0639\u060C \u0642\u0637\u0639\u0627\u062A \u0648\u06CC\u0646\u062A\u06CC\u062C \u06CC\u0627 \u062F\u0633\u062A\u200C\u0633\u0627\u0632 \u0648 \u0645\u06CC\u0632\u0647\u0627\u06CC \u0633\u0628\u06A9\u061B \u0647\u0645\u0627\u0647\u0646\u06AF\u06CC \u0627\u0632 \u0637\u0631\u06CC\u0642 \u0631\u0646\u06AF \u0648 \u0628\u0627\u0641\u062A \u0627\u06CC\u062C\u0627\u062F \u0645\u06CC\u200C\u0634\u0648\u062F \u0646\u0647 \u0633\u062A \u06A9\u0627\u0645\u0644.",
    lightingCharacteristics: "\u0646\u0648\u0631 \u06AF\u0631\u0645 \u0648 \u0635\u0645\u06CC\u0645\u06CC \u0628\u0627 \u0622\u0628\u0627\u0698\u0648\u0631 \u067E\u0627\u0631\u0686\u0647\u200C\u0627\u06CC\u060C \u0641\u0627\u0646\u0648\u0633\u060C \u0631\u06CC\u0633\u0647 \u06CC\u0627 \u0634\u0645\u0639\u061B \u0633\u0627\u06CC\u0647\u200C\u0647\u0627 \u0628\u062E\u0634\u06CC \u0627\u0632 \u062D\u0633 \u0641\u0636\u0627 \u0647\u0633\u062A\u0646\u062F.",
    formCharacteristics: "\u0641\u0631\u0645\u200C\u0647\u0627\u06CC \u0646\u0631\u0645 \u0648 \u0627\u0631\u06AF\u0627\u0646\u06CC\u06A9\u060C \u0644\u0628\u0647\u200C\u0647\u0627\u06CC \u06AF\u0631\u062F \u0648 \u062A\u0631\u06A9\u06CC\u0628 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u0647\u0627\u06CC \u0645\u062A\u0646\u0648\u0639.",
    decorCharacteristics: "\u06AF\u0644\u06CC\u0645\u060C \u0645\u06A9\u0631\u0645\u0647\u060C \u0633\u0628\u062F\u060C \u06A9\u062A\u0627\u0628\u060C \u0622\u062B\u0627\u0631 \u0633\u0641\u0631 \u0648 \u06AF\u06CC\u0627\u0647\u061B \u06AF\u0631\u0648\u0647\u200C\u0628\u0646\u062F\u06CC \u0648 \u0641\u0636\u0627\u06CC \u062E\u0627\u0644\u06CC \u0645\u0627\u0646\u0639 \u0622\u0634\u0641\u062A\u06AF\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F.",
    visualDensity: "\u0645\u062A\u0648\u0633\u0637 \u062A\u0627 \u0632\u06CC\u0627\u062F\u061B \u063A\u0646\u06CC \u0648 \u0644\u0627\u06CC\u0647\u200C\u062F\u0627\u0631\u060C \u0627\u0645\u0627 \u0628\u0627 \u0646\u0642\u0627\u0637 \u0627\u0633\u062A\u0631\u0627\u062D\u062A \u0628\u0635\u0631\u06CC.",
    suitableFor: "\u0627\u0641\u0631\u0627\u062F \u062E\u0644\u0627\u0642 \u0648 \u0645\u062C\u0645\u0648\u0639\u0647\u200C\u062F\u0627\u0631 \u06A9\u0647 \u062E\u0627\u0646\u0647\u200C\u0627\u06CC \u0634\u062E\u0635\u06CC\u060C \u06AF\u0631\u0645 \u0648 \u063A\u06CC\u0631\u0631\u0633\u0645\u06CC \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0646\u062F \u0648 \u0627\u0632 \u0631\u0646\u06AF \u0648 \u0628\u0627\u0641\u062A \u0646\u0645\u06CC\u200C\u062A\u0631\u0633\u0646\u062F.",
    suitableRooms: ["\u0646\u0634\u06CC\u0645\u0646", "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628", "\u0628\u0627\u0644\u06A9\u0646", "\u06AF\u0648\u0634\u0647 \u0645\u0637\u0627\u0644\u0639\u0647"],
    comparisonNote: "\u0628\u0648\u0647\u0648 \u0622\u0632\u0627\u062F \u0648 \u0686\u0646\u062F\u0644\u0627\u06CC\u0647 \u0627\u0633\u062A\u061B \u0645\u062F\u06CC\u062A\u0631\u0627\u0646\u0647\u200C\u0627\u06CC \u067E\u0627\u0644\u062A \u0622\u0641\u062A\u0627\u0628\u06CC \u0645\u0634\u0627\u0628\u0647\u06CC \u062F\u0627\u0631\u062F \u0627\u0645\u0627 \u0645\u0639\u0645\u0627\u0631\u06CC \u0633\u0641\u06CC\u062F\u060C \u0633\u0641\u0627\u0644 \u0648 \u062A\u0631\u06A9\u06CC\u0628 \u062E\u0644\u0648\u062A\u200C\u062A\u0631\u06CC \u0631\u0627 \u062A\u0631\u062C\u06CC\u062D \u0645\u06CC\u200C\u062F\u0647\u062F."
  },
  {
    id: "style-rustic",
    slug: "rustic",
    name: "\u0631\u0648\u0633\u062A\u06CC\u06A9",
    nameEn: "Rustic",
    tagline: "\u06AF\u0631\u0645\u0627\u06CC \u0637\u0628\u06CC\u0639\u062A \u0628\u0627 \u0631\u062F\u0650 \u0632\u0645\u0627\u0646",
    shortDescription: "\u0686\u0648\u0628 \u06AF\u0631\u0647\u200C\u062F\u0627\u0631\u060C \u0633\u0646\u06AF\u060C \u0627\u0644\u06CC\u0627\u0641 \u0637\u0628\u06CC\u0639\u06CC \u0648 \u0633\u0627\u062E\u062A \u062F\u0633\u062A\u061B \u0641\u0636\u0627\u06CC\u06CC \u0635\u0645\u06CC\u0645\u06CC \u06A9\u0647 \u0646\u0642\u0635\u200C\u0647\u0627\u06CC \u0637\u0628\u06CC\u0639\u06CC \u0645\u0648\u0627\u062F \u0631\u0627 \u0628\u062E\u0634\u06CC \u0627\u0632 \u0632\u06CC\u0628\u0627\u06CC\u06CC \u0645\u06CC\u200C\u062F\u0627\u0646\u062F.",
    description: "\u0631\u0648\u0633\u062A\u06CC\u06A9 \u0628\u0631 \u0645\u0648\u0627\u062F \u0645\u062D\u0644\u06CC\u060C \u0628\u0627\u0641\u062A \u0637\u0628\u06CC\u0639\u06CC \u0648 \u062D\u0633 \u0627\u0635\u0627\u0644\u062A \u062A\u0645\u0631\u06A9\u0632 \u062F\u0627\u0631\u062F. \u0686\u0648\u0628\u200C\u0647\u0627\u06CC \u0628\u0627\u0632\u06CC\u0627\u0641\u062A\u06CC\u060C \u0633\u0646\u06AF \u0648 \u067E\u0627\u0631\u0686\u0647\u200C\u0647\u0627\u06CC \u0636\u062E\u06CC\u0645 \u0641\u0636\u0627\u06CC\u06CC \u06AF\u0631\u0645 \u0645\u06CC\u200C\u0633\u0627\u0632\u0646\u062F. \u0628\u0631\u0627\u06CC \u0622\u0646\u06A9\u0647 \u062E\u0627\u0646\u0647 \u0634\u0628\u06CC\u0647 \u06A9\u0644\u0628\u0647\u200C\u06CC \u0645\u0648\u0636\u0648\u0639\u06CC \u0646\u0634\u0648\u062F\u060C \u0628\u0647\u062A\u0631 \u0627\u0633\u062A \u0633\u0637\u0648\u062D \u062E\u0627\u0645 \u0628\u0627 \u062E\u0637\u0648\u0637 \u0633\u0627\u062F\u0647 \u0648 \u0686\u0646\u062F \u0642\u0637\u0639\u0647\u200C\u06CC \u0627\u0645\u0631\u0648\u0632\u06CC \u0645\u062A\u0639\u0627\u062F\u0644 \u0634\u0648\u0646\u062F.",
    image: IMG.styleRustic,
    imageAlt: "\u0646\u0634\u06CC\u0645\u0646 \u0631\u0648\u0633\u062A\u06CC\u06A9 \u0628\u0627 \u062F\u06CC\u0648\u0627\u0631 \u0686\u0648\u0628\u06CC\u060C \u0633\u0646\u06AF \u0648 \u0634\u0648\u0645\u06CC\u0646\u0647",
    colorPalette: [
      { name: "\u06A9\u0631\u0645 \u067E\u0634\u0645\u06CC", hex: "#E3D5BD" },
      { name: "\u0686\u0648\u0628 \u0639\u0633\u0644\u06CC", hex: "#A9784F" },
      { name: "\u0642\u0647\u0648\u0647\u200C\u0627\u06CC \u067E\u0648\u0633\u062A", hex: "#664936" },
      { name: "\u0633\u0628\u0632 \u062E\u0632\u0647\u200C\u0627\u06CC", hex: "#697057" },
      { name: "\u062E\u0627\u06A9\u0633\u062A\u0631\u06CC \u0633\u0646\u06AF", hex: "#87857C" }
    ],
    materials: ["\u0686\u0648\u0628 \u0628\u0627\u0632\u06CC\u0627\u0641\u062A\u06CC", "\u0633\u0646\u06AF \u0637\u0628\u06CC\u0639\u06CC", "\u067E\u0634\u0645", "\u06A9\u062A\u0627\u0646 \u0636\u062E\u06CC\u0645", "\u0622\u0647\u0646 \u067E\u062A\u06CC\u0646\u0647\u200C\u062F\u0627\u0631"],
    keyFeatures: ["\u0628\u0627\u0641\u062A \u0637\u0628\u06CC\u0639\u06CC \u0622\u0634\u06A9\u0627\u0631", "\u0633\u0627\u062E\u062A \u062F\u0633\u062A \u0648 \u062F\u0648\u0627\u0645", "\u0631\u0646\u06AF\u200C\u0647\u0627\u06CC \u0632\u0645\u06CC\u0646\u06CC", "\u062D\u0633 \u0635\u0645\u06CC\u0645\u06CC \u0648 \u0628\u06CC\u200C\u062A\u06A9\u0644\u0641"],
    furnitureCharacteristics: "\u0645\u0628\u0644\u0645\u0627\u0646 \u0631\u0627\u062D\u062A \u0648 \u0645\u0642\u0627\u0648\u0645 \u0628\u0627 \u0686\u0648\u0628 \u0636\u062E\u06CC\u0645\u060C \u0631\u0648\u06A9\u0634 \u06A9\u062A\u0627\u0646\u06CC \u06CC\u0627 \u0686\u0631\u0645\u06CC \u0648 \u0641\u0631\u0645\u200C\u0647\u0627\u06CC \u0633\u0627\u062F\u0647\u061B \u0622\u062B\u0627\u0631 \u062F\u0633\u062A \u0648 \u0633\u0646 \u0645\u0627\u062F\u0647 \u067E\u0630\u06CC\u0631\u0641\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.",
    lightingCharacteristics: "\u0646\u0648\u0631 \u06AF\u0631\u0645\u060C \u0622\u0628\u0627\u0698\u0648\u0631\u0647\u0627\u06CC \u067E\u0627\u0631\u0686\u0647\u200C\u0627\u06CC\u060C \u0686\u0631\u0627\u063A \u0622\u0647\u0646\u06CC \u0648 \u062F\u0631 \u0635\u0648\u0631\u062A \u0627\u0645\u06A9\u0627\u0646 \u0646\u0648\u0631 \u0622\u062A\u0634\u061B \u0646\u0648\u0631 \u0633\u0641\u06CC\u062F \u0633\u0631\u062F \u0628\u0627 \u0627\u06CC\u0646 \u0633\u0628\u06A9 \u0646\u0627\u0633\u0627\u0632\u06AF\u0627\u0631 \u0627\u0633\u062A.",
    formCharacteristics: "\u0641\u0631\u0645\u200C\u0647\u0627\u06CC \u0633\u0627\u062F\u0647 \u0648 \u0633\u0646\u06AF\u06CC\u0646\u060C \u0644\u0628\u0647\u200C\u0647\u0627\u06CC \u0637\u0628\u06CC\u0639\u06CC \u0648 \u062A\u0646\u0627\u0633\u0628\u200C\u0647\u0627\u06CC \u0645\u062D\u06A9\u0645.",
    decorCharacteristics: "\u0633\u0628\u062F\u060C \u0633\u0641\u0627\u0644\u060C \u067E\u0627\u0631\u0686\u0647 \u0686\u0647\u0627\u0631\u062E\u0627\u0646\u0647 \u06CC\u0627 \u0633\u0627\u062F\u0647\u060C \u0634\u0627\u062E\u0647\u200C\u0647\u0627\u06CC \u062E\u0634\u06A9 \u0648 \u0627\u0628\u0632\u0627\u0631 \u0642\u062F\u06CC\u0645\u06CC \u0645\u062D\u062F\u0648\u062F\u061B \u0637\u0628\u06CC\u0639\u062A \u0645\u0646\u0628\u0639 \u0627\u0635\u0644\u06CC \u062A\u0632\u0626\u06CC\u0646 \u0627\u0633\u062A.",
    visualDensity: "\u0645\u062A\u0648\u0633\u0637\u061B \u0628\u0627\u0641\u062A \u0632\u06CC\u0627\u062F \u0627\u0633\u062A \u0627\u0645\u0627 \u0686\u06CC\u062F\u0645\u0627\u0646 \u0631\u0627\u062D\u062A \u0648 \u062E\u0648\u0627\u0646\u0627 \u0628\u0627\u0642\u06CC \u0645\u06CC\u200C\u0645\u0627\u0646\u062F.",
    suitableFor: "\u06A9\u0633\u0627\u0646\u06CC \u06A9\u0647 \u06AF\u0631\u0645\u0627\u060C \u062F\u0648\u0627\u0645\u060C \u0637\u0628\u06CC\u0639\u062A \u0648 \u0641\u0636\u0627\u06CC\u06CC \u063A\u06CC\u0631\u0631\u0633\u0645\u06CC \u0628\u0631\u0627\u06CC \u062F\u0648\u0631\u0647\u0645\u06CC \u0631\u0627 \u0628\u0647 \u0633\u0637\u0648\u062D \u0628\u06CC\u200C\u0646\u0642\u0635 \u062A\u0631\u062C\u06CC\u062D \u0645\u06CC\u200C\u062F\u0647\u0646\u062F.",
    suitableRooms: ["\u0646\u0634\u06CC\u0645\u0646", "\u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647", "\u062E\u0627\u0646\u0647 \u0628\u0627\u063A", "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628"],
    comparisonNote: "\u0631\u0648\u0633\u062A\u06CC\u06A9 \u06AF\u0631\u0645 \u0648 \u0637\u0628\u06CC\u0639\u062A\u200C\u0645\u062D\u0648\u0631 \u0627\u0633\u062A\u061B \u0635\u0646\u0639\u062A\u06CC \u0627\u0632 \u0641\u0644\u0632\u060C \u0628\u062A\u0646 \u0648 \u0647\u0646\u062F\u0633\u0647\u200C\u06CC \u0634\u0647\u0631\u06CC \u0633\u0647\u0645 \u0628\u06CC\u0634\u062A\u0631\u06CC \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F \u0648 \u0645\u0639\u0645\u0648\u0644\u0627\u064B \u06A9\u0646\u062A\u0631\u0627\u0633\u062A \u062A\u06CC\u0631\u0647\u200C\u062A\u0631\u06CC \u062F\u0627\u0631\u062F."
  },
  {
    id: "style-mediterranean",
    slug: "mediterranean",
    name: "\u0645\u062F\u06CC\u062A\u0631\u0627\u0646\u0647\u200C\u0627\u06CC",
    nameEn: "Mediterranean",
    tagline: "\u0646\u0648\u0631 \u0622\u0641\u062A\u0627\u0628\u060C \u062F\u06CC\u0648\u0627\u0631 \u0633\u0641\u06CC\u062F\u060C \u062E\u0627\u06A9 \u0648 \u062F\u0631\u06CC\u0627",
    shortDescription: "\u0641\u0636\u0627\u06CC\u06CC \u0631\u0648\u0634\u0646 \u0648 \u0628\u06CC\u200C\u062A\u06A9\u0644\u0641 \u0628\u0627 \u06AF\u0686 \u0633\u0641\u06CC\u062F\u060C \u0633\u0641\u0627\u0644\u060C \u0686\u0648\u0628 \u0648 \u0622\u0628\u06CC\u200C\u0647\u0627\u06CC \u062F\u0631\u06CC\u0627\u06CC\u06CC \u06A9\u0647 \u0632\u0646\u062F\u06AF\u06CC \u062F\u0627\u062E\u0644 \u0648 \u0628\u06CC\u0631\u0648\u0646 \u0631\u0627 \u0628\u0647 \u0647\u0645 \u0646\u0632\u062F\u06CC\u06A9 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    description: "\u0633\u0628\u06A9 \u0645\u062F\u06CC\u062A\u0631\u0627\u0646\u0647\u200C\u0627\u06CC \u0627\u0632 \u062E\u0627\u0646\u0647\u200C\u0647\u0627\u06CC \u0633\u0627\u062D\u0644\u06CC \u062C\u0646\u0648\u0628 \u0627\u0631\u0648\u067E\u0627 \u0648 \u0634\u0645\u0627\u0644 \u0622\u0641\u0631\u06CC\u0642\u0627 \u0627\u0644\u0647\u0627\u0645 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F. \u062F\u06CC\u0648\u0627\u0631\u0647\u0627\u06CC \u0622\u0647\u06A9\u06CC\u060C \u0642\u0648\u0633\u200C\u0647\u0627\u060C \u0633\u0641\u0627\u0644\u060C \u067E\u0627\u0631\u0686\u0647\u200C\u0647\u0627\u06CC \u0633\u0628\u06A9 \u0648 \u0631\u0646\u06AF\u200C\u0647\u0627\u06CC \u0622\u0641\u062A\u0627\u0628\u200C\u062E\u0648\u0631\u062F\u0647 \u0648\u06CC\u0698\u06AF\u06CC \u0622\u0646\u200C\u0627\u0646\u062F. \u0646\u0633\u062E\u0647\u200C\u06CC \u0627\u0645\u0631\u0648\u0632\u06CC \u0627\u06CC\u0646 \u0633\u0628\u06A9 \u0627\u0632 \u062A\u0645\u200C\u0647\u0627\u06CC \u062F\u0631\u06CC\u0627\u06CC\u06CC \u0645\u0633\u062A\u0642\u06CC\u0645 \u0641\u0627\u0635\u0644\u0647 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F \u0648 \u0628\u0631 \u0628\u0627\u0641\u062A \u0645\u0639\u0645\u0627\u0631\u06CC \u0648 \u0645\u0648\u0627\u062F \u0637\u0628\u06CC\u0639\u06CC \u062A\u0645\u0631\u06A9\u0632 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    image: IMG.styleMediterranean,
    imageAlt: "\u0641\u0636\u0627\u06CC \u0645\u062F\u06CC\u062A\u0631\u0627\u0646\u0647\u200C\u0627\u06CC \u0622\u0641\u062A\u0627\u0628\u06CC \u0628\u0627 \u0642\u0648\u0633\u060C \u062F\u06CC\u0648\u0627\u0631 \u0631\u0648\u0634\u0646 \u0648 \u0633\u0641\u0627\u0644",
    colorPalette: [
      { name: "\u0633\u0641\u06CC\u062F \u0622\u0647\u06A9\u06CC", hex: "#F1EBDD" },
      { name: "\u0645\u0627\u0633\u0647\u200C\u0627\u06CC", hex: "#D1B991" },
      { name: "\u062A\u0631\u0627\u06A9\u0648\u062A\u0627", hex: "#B86444" },
      { name: "\u0622\u0628\u06CC \u0627\u0698\u0647", hex: "#3F7180" },
      { name: "\u0632\u06CC\u062A\u0648\u0646\u06CC", hex: "#6E7654" }
    ],
    materials: ["\u06AF\u0686 \u0622\u0647\u06A9\u06CC", "\u062A\u0631\u0627\u06A9\u0648\u062A\u0627", "\u0633\u0646\u06AF", "\u0686\u0648\u0628 \u0637\u0628\u06CC\u0639\u06CC", "\u06A9\u062A\u0627\u0646 \u0648 \u062D\u0635\u06CC\u0631"],
    keyFeatures: ["\u0646\u0648\u0631 \u0648 \u062A\u0647\u0648\u06CC\u0647 \u0641\u0631\u0627\u0648\u0627\u0646", "\u0642\u0648\u0633 \u0648 \u06AF\u0648\u0634\u0647\u200C\u0647\u0627\u06CC \u0646\u0631\u0645", "\u0631\u0646\u06AF\u200C\u0647\u0627\u06CC \u0622\u0641\u062A\u0627\u0628\u200C\u062E\u0648\u0631\u062F\u0647", "\u067E\u06CC\u0648\u0646\u062F \u062F\u0627\u062E\u0644 \u0648 \u0628\u06CC\u0631\u0648\u0646"],
    furnitureCharacteristics: "\u0645\u0628\u0644\u0645\u0627\u0646 \u0631\u0627\u062D\u062A \u0628\u0627 \u0686\u0648\u0628 \u06CC\u0627 \u0622\u0647\u0646 \u062F\u0633\u062A\u200C\u0633\u0627\u0632\u060C \u0631\u0648\u06A9\u0634 \u06A9\u062A\u0627\u0646\u06CC \u0631\u0648\u0634\u0646 \u0648 \u0642\u0637\u0639\u0627\u062A \u062D\u0635\u06CC\u0631\u06CC\u061B \u0641\u0631\u0645\u200C\u0647\u0627 \u0633\u0627\u062F\u0647 \u0648 \u0645\u0646\u0627\u0633\u0628 \u062F\u0648\u0631\u0647\u0645\u06CC\u200C\u0627\u0646\u062F.",
    lightingCharacteristics: "\u0627\u0648\u0644\u0648\u06CC\u062A \u0628\u0627 \u0646\u0648\u0631 \u0631\u0648\u0632\u060C \u067E\u0631\u062F\u0647\u200C\u0647\u0627\u06CC \u0646\u0627\u0632\u06A9 \u0648 \u0641\u0627\u0646\u0648\u0633 \u06CC\u0627 \u062F\u06CC\u0648\u0627\u0631\u06A9\u0648\u0628 \u0628\u0627 \u0646\u0648\u0631 \u06A9\u0647\u0631\u0628\u0627\u06CC\u06CC \u062F\u0631 \u0634\u0628.",
    formCharacteristics: "\u0642\u0648\u0633\u060C \u062F\u06CC\u0648\u0627\u0631\u0647\u0627\u06CC \u0646\u0631\u0645 \u0648 \u0646\u0627\u0645\u0646\u0638\u0645\u060C \u06AF\u0648\u0634\u0647\u200C\u0647\u0627\u06CC \u06AF\u0631\u062F \u0648 \u0641\u0631\u0645\u200C\u0647\u0627\u06CC \u0627\u0644\u0647\u0627\u0645\u200C\u06AF\u0631\u0641\u062A\u0647 \u0627\u0632 \u0645\u0639\u0645\u0627\u0631\u06CC \u0628\u0648\u0645\u06CC.",
    decorCharacteristics: "\u0633\u0641\u0627\u0644\u060C \u0638\u0631\u0648\u0641 \u062F\u0633\u062A\u200C\u0633\u0627\u0632\u060C \u0634\u0627\u062E\u0647 \u0632\u06CC\u062A\u0648\u0646\u060C \u067E\u0627\u0631\u0686\u0647 \u0631\u0627\u0647\u200C\u0631\u0627\u0647 \u0645\u062D\u062F\u0648\u062F \u0648 \u0633\u0628\u062F\u061B \u0627\u0632 \u0644\u0646\u06AF\u0631 \u0648 \u0635\u062F\u0641\u0650 \u062A\u0645\u0627\u062A\u06CC\u06A9 \u067E\u0631\u0647\u06CC\u0632 \u0645\u06CC\u200C\u0634\u0648\u062F.",
    visualDensity: "\u06A9\u0645 \u062A\u0627 \u0645\u062A\u0648\u0633\u0637\u061B \u0628\u0627\u0641\u062A \u0645\u0639\u0645\u0627\u0631\u06CC \u062C\u0627\u06CC \u062A\u0632\u0626\u06CC\u0646\u0627\u062A \u0632\u06CC\u0627\u062F \u0631\u0627 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F.",
    suitableFor: "\u0627\u0641\u0631\u0627\u062F\u06CC \u06A9\u0647 \u062E\u0627\u0646\u0647\u200C\u0627\u06CC \u0622\u0641\u062A\u0627\u0628\u06CC\u060C \u0645\u0647\u0645\u0627\u0646\u200C\u067E\u0630\u06CC\u0631\u060C \u0637\u0628\u06CC\u0639\u06CC \u0648 \u0646\u0632\u062F\u06CC\u06A9 \u0628\u0647 \u062D\u0633 \u0633\u0641\u0631 \u0648 \u0641\u0636\u0627\u06CC \u0628\u0627\u0632 \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0646\u062F.",
    suitableRooms: ["\u0646\u0634\u06CC\u0645\u0646", "\u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647", "\u062A\u0631\u0627\u0633", "\u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC"],
    comparisonNote: "\u0645\u062F\u06CC\u062A\u0631\u0627\u0646\u0647\u200C\u0627\u06CC \u0645\u0627\u0646\u0646\u062F \u0628\u0648\u0647\u0648 \u06AF\u0631\u0645 \u0648 \u062F\u0633\u062A\u200C\u0633\u0627\u0632 \u0627\u0633\u062A\u060C \u0627\u0645\u0627 \u067E\u0627\u0644\u062A \u0631\u0648\u0634\u0646\u200C\u062A\u0631\u060C \u0645\u0639\u0645\u0627\u0631\u06CC \u0642\u0648\u0633\u200C\u062F\u0627\u0631 \u0648 \u0686\u06CC\u062F\u0645\u0627\u0646 \u062E\u0644\u0648\u062A\u200C\u062A\u0631\u06CC \u062F\u0627\u0631\u062F."
  },
  {
    id: "style-contemporary",
    slug: "contemporary",
    name: "\u0645\u0639\u0627\u0635\u0631",
    nameEn: "Contemporary",
    tagline: "\u0637\u0631\u0627\u062D\u06CC \u0627\u0645\u0631\u0648\u0632\u060C \u0628\u0627\u0632 \u0648 \u062F\u0631 \u062D\u0627\u0644 \u062A\u062D\u0648\u0644",
    shortDescription: "\u0628\u0631\u062F\u0627\u0634\u062A \u0627\u0645\u0631\u0648\u0632 \u0627\u0632 \u0637\u0631\u0627\u062D\u06CC \u062F\u0627\u062E\u0644\u06CC\u061B \u062E\u0637\u0648\u0637 \u062A\u0645\u06CC\u0632 \u062F\u0631 \u06A9\u0646\u0627\u0631 \u0645\u0646\u062D\u0646\u06CC\u200C\u0647\u0627\u06CC \u0634\u0627\u062E\u0635\u060C \u0647\u0646\u0631 \u062C\u0633\u0648\u0631 \u0648 \u0641\u0646\u0627\u0648\u0631\u06CC \u067E\u0646\u0647\u0627\u0646.",
    description: "\u0645\u0639\u0627\u0635\u0631 \u0628\u0647 \u0622\u0646\u0686\u0647 \u0627\u06A9\u0646\u0648\u0646 \u062F\u0631 \u0637\u0631\u0627\u062D\u06CC \u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A \u0627\u0634\u0627\u0631\u0647 \u062F\u0627\u0631\u062F \u0648 \u0628\u0631\u062E\u0644\u0627\u0641 \u0645\u062F\u0631\u0646\u060C \u0628\u0647 \u06CC\u06A9 \u062F\u0648\u0631\u0647\u200C\u06CC \u062A\u0627\u0631\u06CC\u062E\u06CC \u0645\u062D\u062F\u0648\u062F \u0646\u06CC\u0633\u062A. \u0627\u0645\u0631\u0648\u0632 \u0627\u06CC\u0646 \u0633\u0628\u06A9 \u0628\u0627 \u067E\u0627\u0644\u062A \u062E\u0646\u062B\u06CC \u06AF\u0631\u0645\u060C \u0641\u0631\u0645\u200C\u0647\u0627\u06CC \u0645\u062C\u0633\u0645\u0647\u200C\u0648\u0627\u0631\u060C \u0645\u0642\u06CC\u0627\u0633 \u062C\u0633\u0648\u0631 \u0648 \u0645\u0648\u0627\u062F \u0646\u0648 \u0634\u0646\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0627\u0646\u0639\u0637\u0627\u0641\u200C\u067E\u0630\u06CC\u0631\u06CC \u0646\u0642\u0637\u0647 \u0642\u0648\u062A \u0622\u0646 \u0627\u0633\u062A\u060C \u0627\u0645\u0627 \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0647\u0627 \u0628\u0627\u06CC\u062F \u06CC\u06A9 \u0627\u06CC\u062F\u0647\u200C\u06CC \u0645\u0631\u06A9\u0632\u06CC \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u0646\u062F \u062A\u0627 \u0641\u0636\u0627 \u062A\u0631\u0646\u062F\u0632\u062F\u0647 \u0646\u0634\u0648\u062F.",
    image: IMG.styleContemporary,
    imageAlt: "\u0646\u0634\u06CC\u0645\u0646 \u0645\u0639\u0627\u0635\u0631 \u0628\u0627 \u0641\u0631\u0645\u200C\u0647\u0627\u06CC \u0645\u0646\u062D\u0646\u06CC\u060C \u0647\u0646\u0631 \u0634\u0627\u062E\u0635 \u0648 \u067E\u0627\u0644\u062A \u062E\u0646\u062B\u06CC",
    colorPalette: [
      { name: "\u06AF\u0631\u06CC\u0698 \u0631\u0648\u0634\u0646", hex: "#D8D0C3" },
      { name: "\u062A\u0627\u067E", hex: "#9B8B7B" },
      { name: "\u0630\u063A\u0627\u0644\u06CC", hex: "#343A38" },
      { name: "\u0633\u0628\u0632 \u0639\u0645\u06CC\u0642", hex: "#345447" },
      { name: "\u0622\u0628\u06CC \u0647\u0646\u0631\u06CC", hex: "#456B78" }
    ],
    materials: ["\u0633\u0646\u06AF \u0645\u0647\u0646\u062F\u0633\u06CC", "\u0686\u0648\u0628", "\u0634\u06CC\u0634\u0647", "\u0641\u0644\u0632", "\u067E\u0627\u0631\u0686\u0647\u200C\u0647\u0627\u06CC \u0628\u0627\u0641\u062A\u200C\u062F\u0627\u0631"],
    keyFeatures: ["\u062A\u0631\u06A9\u06CC\u0628 \u062E\u0637 \u0648 \u0645\u0646\u062D\u0646\u06CC", "\u06CC\u06A9 \u0646\u0642\u0637\u0647\u200C\u06CC \u06A9\u0627\u0646\u0648\u0646\u06CC \u062C\u0633\u0648\u0631", "\u0641\u0646\u0627\u0648\u0631\u06CC \u06CC\u06A9\u067E\u0627\u0631\u0686\u0647", "\u0641\u0636\u0627\u06CC \u0628\u0627\u0632 \u0648 \u0645\u0646\u0639\u0637\u0641"],
    furnitureCharacteristics: "\u0645\u0628\u0644\u0645\u0627\u0646 \u0631\u0627\u062D\u062A \u0628\u0627 \u0641\u0631\u0645 \u0645\u062C\u0633\u0645\u0647\u200C\u0648\u0627\u0631\u060C \u06A9\u0627\u0646\u0627\u067E\u0647\u200C\u0647\u0627\u06CC \u0645\u0627\u0698\u0648\u0644\u0627\u0631 \u0648 \u0686\u0646\u062F \u0642\u0637\u0639\u0647\u200C\u06CC \u0637\u0631\u0627\u062D\u06CC \u0634\u0627\u062E\u0635\u061B \u062A\u0631\u06A9\u06CC\u0628 \u0628\u0631\u0646\u062F \u0648 \u062F\u0648\u0631\u0647 \u0622\u0632\u0627\u062F \u0627\u0633\u062A.",
    lightingCharacteristics: "\u0646\u0648\u0631 \u0645\u0639\u0645\u0627\u0631\u06CC \u0645\u062E\u0641\u06CC \u0647\u0645\u0631\u0627\u0647 \u0628\u0627 \u0686\u0631\u0627\u063A\u200C\u0647\u0627\u06CC \u0645\u062C\u0633\u0645\u0647\u200C\u0648\u0627\u0631\u061B \u0633\u0646\u0627\u0631\u06CC\u0648\u0647\u0627\u06CC \u0642\u0627\u0628\u0644\u200C\u062A\u0646\u0638\u06CC\u0645 \u0628\u0631\u0627\u06CC \u0641\u0639\u0627\u0644\u06CC\u062A\u200C\u0647\u0627\u06CC \u0645\u062E\u062A\u0644\u0641.",
    formCharacteristics: "\u0647\u0646\u062F\u0633\u0647\u200C\u06CC \u062A\u0645\u06CC\u0632 \u062F\u0631 \u06A9\u0646\u0627\u0631 \u0642\u0648\u0633 \u0648 \u0627\u062D\u062C\u0627\u0645 \u0646\u0631\u0645 \u0628\u0632\u0631\u06AF\u061B \u0628\u0627\u0632\u06CC \u0622\u06AF\u0627\u0647\u0627\u0646\u0647 \u0628\u0627 \u0645\u0642\u06CC\u0627\u0633.",
    decorCharacteristics: "\u0647\u0646\u0631 \u0645\u0639\u0627\u0635\u0631 \u0628\u0632\u0631\u06AF\u060C \u0627\u06A9\u0633\u0633\u0648\u0631\u06CC \u0645\u062D\u062F\u0648\u062F \u0648 \u0628\u0627\u0641\u062A\u200C\u062F\u0627\u0631 \u0648 \u06AF\u06CC\u0627\u0647\u0627\u0646 \u0633\u0627\u062E\u062A\u0627\u0631\u06CC\u061B \u062A\u0631\u0646\u062F\u0647\u0627 \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u0646\u0642\u0637\u0647\u200C\u0627\u06CC \u0648\u0627\u0631\u062F \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.",
    visualDensity: "\u06A9\u0645 \u062A\u0627 \u0645\u062A\u0648\u0633\u0637\u061B \u0686\u0646\u062F \u0639\u0646\u0635\u0631 \u0634\u0627\u062E\u0635 \u0628\u0647\u200C\u062C\u0627\u06CC \u062A\u0639\u062F\u0627\u062F \u0632\u06CC\u0627\u062F \u0627\u0634\u06CC\u0627.",
    suitableFor: "\u06A9\u0633\u0627\u0646\u06CC \u06A9\u0647 \u062E\u0627\u0646\u0647\u200C\u0627\u06CC \u0628\u0647\u200C\u0631\u0648\u0632\u060C \u0645\u0646\u0639\u0637\u0641 \u0648 \u0647\u0646\u0631\u06CC \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0646\u062F \u0648 \u0627\u0632 \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u062A\u062F\u0631\u06CC\u062C\u06CC \u0641\u0636\u0627 \u0644\u0630\u062A \u0645\u06CC\u200C\u0628\u0631\u0646\u062F.",
    suitableRooms: ["\u0646\u0634\u06CC\u0645\u0646", "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631", "\u0622\u0634\u067E\u0632\u062E\u0627\u0646\u0647", "\u062E\u0627\u0646\u0647\u200C\u0647\u0627\u06CC \u067E\u0644\u0627\u0646 \u0628\u0627\u0632"],
    comparisonNote: "\u0645\u062F\u0631\u0646 \u0628\u0647 \u0627\u0635\u0648\u0644 \u0642\u0631\u0646 \u0628\u06CC\u0633\u062A\u0645 \u0648\u0641\u0627\u062F\u0627\u0631 \u0627\u0633\u062A\u061B \u0645\u0639\u0627\u0635\u0631 \u062A\u063A\u06CC\u06CC\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u0627\u0645\u0631\u0648\u0632 \u0641\u0631\u0645\u200C\u0647\u0627\u06CC \u0645\u0646\u062D\u0646\u06CC\u060C \u0645\u0648\u0627\u062F \u0646\u0648 \u0648 \u0647\u0646\u0631 \u062C\u0633\u0648\u0631 \u0631\u0627 \u0622\u0632\u0627\u062F\u0627\u0646\u0647\u200C\u062A\u0631 \u0645\u06CC\u200C\u067E\u0630\u06CC\u0631\u062F."
  },
  {
    id: "style-art-deco",
    slug: "art-deco",
    name: "\u0622\u0631\u062A \u062F\u06A9\u0648",
    nameEn: "Art Deco",
    tagline: "\u0647\u0646\u062F\u0633\u0647\u200C\u06CC \u0646\u0645\u0627\u06CC\u0634\u06CC \u0648 \u062F\u0631\u062E\u0634\u0634 \u06A9\u0646\u062A\u0631\u0644\u200C\u0634\u062F\u0647",
    shortDescription: "\u062A\u0642\u0627\u0631\u0646 \u062C\u0633\u0648\u0631\u060C \u062E\u0637\u0648\u0637 \u067E\u0644\u0647\u200C\u0627\u06CC \u0648 \u0628\u0627\u062F\u0628\u0632\u0646\u06CC\u060C \u0645\u062E\u0645\u0644 \u0648 \u0641\u0644\u0632\u0627\u062A \u06AF\u0631\u0645\u061B \u0633\u0628\u06A9\u06CC \u0646\u0645\u0627\u06CC\u0634\u06CC \u0627\u0632 \u062F\u0647\u0647\u200C\u0647\u0627\u06CC \u06F1\u06F9\u06F2\u06F0 \u0648 \u06F1\u06F9\u06F3\u06F0.",
    description: "\u0622\u0631\u062A \u062F\u06A9\u0648 \u062C\u0634\u0646 \u067E\u06CC\u0634\u0631\u0641\u062A \u0635\u0646\u0639\u062A\u06CC \u0648 \u0645\u0647\u0627\u0631\u062A \u062A\u0632\u0626\u06CC\u0646\u06CC \u062F\u0631 \u0641\u0627\u0635\u0644\u0647\u200C\u06CC \u062F\u0648 \u062C\u0646\u06AF \u062C\u0647\u0627\u0646\u06CC \u0628\u0648\u062F. \u0647\u0646\u062F\u0633\u0647\u200C\u06CC \u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647\u060C \u0633\u0637\u0648\u062D \u0628\u0631\u0627\u0642\u060C \u0686\u0648\u0628\u200C\u0647\u0627\u06CC \u062A\u06CC\u0631\u0647\u060C \u0634\u06CC\u0634\u0647 \u0648 \u0628\u0631\u0646\u062C \u0628\u0647 \u0622\u0646 \u0634\u062E\u0635\u06CC\u062A \u0645\u06CC\u200C\u062F\u0647\u0646\u062F. \u0628\u0631\u0627\u06CC \u062E\u0627\u0646\u0647\u200C\u06CC \u0627\u0645\u0631\u0648\u0632\u060C \u06CC\u06A9 \u06CC\u0627 \u062F\u0648 \u0627\u0644\u06AF\u0648\u06CC \u0634\u0627\u062E\u0635 \u0648 \u0641\u0644\u0632 \u06AF\u0631\u0645 \u06A9\u0627\u0641\u06CC \u0627\u0633\u062A\u061B \u0627\u0633\u062A\u0641\u0627\u062F\u0647\u200C\u06CC \u0647\u0645\u200C\u0632\u0645\u0627\u0646 \u0627\u0632 \u0647\u0645\u0647\u200C\u06CC \u0646\u0634\u0627\u0646\u0647\u200C\u0647\u0627 \u0641\u0636\u0627 \u0631\u0627 \u0635\u062D\u0646\u0647\u200C\u0627\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    image: IMG.styleArtDeco,
    imageAlt: "\u0641\u0636\u0627\u06CC \u0622\u0631\u062A \u062F\u06A9\u0648 \u0628\u0627 \u0647\u0646\u062F\u0633\u0647 \u0645\u062A\u0642\u0627\u0631\u0646\u060C \u0646\u0648\u0631 \u06AF\u0631\u0645\u060C \u0645\u062E\u0645\u0644 \u0648 \u062C\u0632\u0626\u06CC\u0627\u062A \u0628\u0631\u0646\u062C\u06CC",
    colorPalette: [
      { name: "\u0633\u0628\u0632 \u0632\u0645\u0631\u062F\u06CC", hex: "#164F45" },
      { name: "\u0633\u0631\u0645\u0647\u200C\u0627\u06CC", hex: "#24354A" },
      { name: "\u0645\u0634\u06A9\u06CC \u0644\u0627\u06A9\u06CC", hex: "#1D1D1E" },
      { name: "\u0637\u0644\u0627\u06CC\u06CC \u0628\u0631\u0646\u062C\u06CC", hex: "#C09A52" },
      { name: "\u0635\u0648\u0631\u062A\u06CC \u0686\u0631\u06A9", hex: "#B98482" }
    ],
    materials: ["\u0628\u0631\u0646\u062C", "\u0645\u062E\u0645\u0644", "\u0634\u06CC\u0634\u0647 \u062F\u0648\u062F\u06CC", "\u0645\u0631\u0645\u0631", "\u0686\u0648\u0628 \u062A\u06CC\u0631\u0647 \u0648 \u0644\u0627\u06A9"],
    keyFeatures: ["\u062A\u0642\u0627\u0631\u0646 \u062C\u0633\u0648\u0631", "\u0627\u0644\u06AF\u0648\u0647\u0627\u06CC \u0647\u0646\u062F\u0633\u06CC", "\u06A9\u0646\u062A\u0631\u0627\u0633\u062A \u0631\u0646\u06AF \u0639\u0645\u06CC\u0642", "\u062F\u0631\u062E\u0634\u0634 \u0641\u0644\u0632\u06CC \u06A9\u0646\u062A\u0631\u0644\u200C\u0634\u062F\u0647"],
    furnitureCharacteristics: "\u0645\u0628\u0644\u0645\u0627\u0646 \u0628\u0627 \u0627\u0646\u062D\u0646\u0627\u06CC \u0646\u0645\u0627\u06CC\u0634\u06CC\u060C \u0631\u0648\u06A9\u0634 \u0645\u062E\u0645\u0644 \u0648 \u067E\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u0641\u0644\u0632\u06CC \u0638\u0631\u06CC\u0641\u061B \u06CC\u06A9 \u06A9\u0646\u0633\u0648\u0644 \u06CC\u0627 \u0635\u0646\u062F\u0644\u06CC \u0634\u0627\u062E\u0635 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0632\u0628\u0627\u0646 \u0633\u0628\u06A9 \u0631\u0627 \u0628\u0633\u0627\u0632\u062F.",
    lightingCharacteristics: "\u062F\u06CC\u0648\u0627\u0631\u06A9\u0648\u0628\u200C\u0647\u0627\u06CC \u0645\u062A\u0642\u0627\u0631\u0646\u060C \u0634\u06CC\u0634\u0647 \u0634\u06CC\u0627\u0631\u062F\u0627\u0631 \u0648 \u0622\u0648\u06CC\u0632\u0647\u0627\u06CC \u0647\u0646\u062F\u0633\u06CC \u0628\u0627 \u0646\u0648\u0631 \u0637\u0644\u0627\u06CC\u06CC\u061B \u0686\u0631\u0627\u063A \u062E\u0648\u062F \u06CC\u06A9 \u0634\u06CC\u0621 \u062A\u0632\u0626\u06CC\u0646\u06CC \u0627\u0633\u062A.",
    formCharacteristics: "\u0632\u06CC\u06AF\u0632\u0627\u06AF\u060C \u0628\u0627\u062F\u0628\u0632\u0646\u06CC\u060C \u062E\u0637\u0648\u0637 \u067E\u0644\u0647\u200C\u0627\u06CC\u060C \u0642\u0648\u0633\u200C\u0647\u0627\u06CC \u0645\u0646\u0638\u0645 \u0648 \u062A\u0642\u0627\u0631\u0646 \u0645\u062D\u0648\u0631\u06CC.",
    decorCharacteristics: "\u0622\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0647\u0646\u062F\u0633\u06CC\u060C \u0633\u06CC\u0646\u06CC \u0644\u0627\u06A9\u06CC\u060C \u0645\u062C\u0633\u0645\u0647 \u0648 \u0622\u062B\u0627\u0631 \u06AF\u0631\u0627\u0641\u06CC\u06A9\u06CC\u061B \u0633\u0637\u0648\u062D \u0628\u0631\u0627\u0642 \u0628\u0627 \u0632\u0645\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0645\u0627\u062A \u0645\u062A\u0639\u0627\u062F\u0644 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.",
    visualDensity: "\u0645\u062A\u0648\u0633\u0637\u061B \u062C\u0632\u0626\u06CC\u0627\u062A \u063A\u0646\u06CC\u200C\u0627\u0646\u062F \u0627\u0645\u0627 \u0686\u06CC\u062F\u0645\u0627\u0646 \u0628\u0627\u06CC\u062F \u0645\u0646\u0638\u0645 \u0648 \u0646\u0642\u0627\u0637 \u0634\u0627\u062E\u0635 \u0645\u062D\u062F\u0648\u062F \u0628\u0627\u0634\u062F.",
    suitableFor: "\u0627\u0641\u0631\u0627\u062F\u06CC \u06A9\u0647 \u0641\u0636\u0627\u06CC \u0646\u0645\u0627\u06CC\u0634\u06CC\u060C \u0631\u0646\u06AF\u200C\u0647\u0627\u06CC \u0639\u0645\u06CC\u0642 \u0648 \u062C\u0632\u0626\u06CC\u0627\u062A \u0644\u0648\u06A9\u0633 \u0631\u0627 \u062F\u0648\u0633\u062A \u062F\u0627\u0631\u0646\u062F \u0627\u0645\u0627 \u0646\u0638\u0645 \u0647\u0646\u062F\u0633\u06CC \u0631\u0627 \u0647\u0645 \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0646\u062F.",
    suitableRooms: ["\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", "\u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC", "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628 \u0627\u0635\u0644\u06CC", "\u0648\u0631\u0648\u062F\u06CC"],
    comparisonNote: "\u0622\u0631\u062A \u062F\u06A9\u0648 \u0628\u0631\u062E\u0644\u0627\u0641 \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0627\u0632 \u0646\u0642\u0648\u0634 \u062A\u0627\u0631\u06CC\u062E\u06CC \u0648 \u0645\u0628\u0644\u0645\u0627\u0646 \u067E\u0631\u06A9\u0627\u0631 \u0641\u0627\u0635\u0644\u0647 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F \u0648 \u0644\u0648\u06A9\u0633\u200C\u0628\u0648\u062F\u0646 \u0631\u0627 \u0628\u0627 \u0647\u0646\u062F\u0633\u0647\u060C \u0645\u0648\u0627\u062F \u0628\u0631\u0627\u0642 \u0648 \u0632\u0628\u0627\u0646 \u0639\u0635\u0631 \u0645\u0627\u0634\u06CC\u0646 \u0646\u0634\u0627\u0646 \u0645\u06CC\u200C\u062F\u0647\u062F."
  }
];
var styleSlugs = styles2.map((style) => style.slug);

// src/data/inspirations.ts
var inspirations2 = [
  { id: "i1", title: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u06AF\u0631\u0645 \u0648 \u062E\u0627\u06A9\u06CC", image: IMG.living2, styleSlug: "modern", room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", tags: ["\u06AF\u0631\u0645", "\u062E\u0627\u06A9\u06CC", "\u0646\u0648\u0631"], productIds: ["p1", "p9", "p15"] },
  { id: "i2", title: "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628 \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC", image: IMG.bed2, styleSlug: "scandinavian", room: "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628", tags: ["\u0622\u0631\u0627\u0645", "\u0686\u0648\u0628"], productIds: ["p19", "p20", "p21"] },
  { id: "i3", title: "\u06AF\u0648\u0634\u0647\u200C\u06CC \u0645\u0637\u0627\u0644\u0639\u0647\u200C\u06CC \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644", image: IMG.decor7, styleSlug: "minimal", room: "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631", tags: ["\u0645\u0637\u0627\u0644\u0639\u0647", "\u0646\u0648\u0631"], productIds: ["p9", "p23"] },
  { id: "i4", title: "\u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC \u0644\u0648\u06A9\u0633", image: IMG.living9, styleSlug: "art-deco", room: "\u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC", tags: ["\u0644\u0648\u06A9\u0633", "\u0634\u06CC\u06A9"], productIds: ["p4", "p10"] },
  { id: "i5", title: "\u067E\u0627\u0644\u062A \u062A\u06A9\u200C\u0631\u0646\u06AF \u0637\u0648\u0633\u06CC", image: IMG.living7, styleSlug: "minimal", room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", tags: ["\u062A\u06A9\u200C\u0631\u0646\u06AF", "\u0637\u0648\u0633\u06CC"], productIds: ["p29", "p15"] },
  { id: "i6", title: "\u0628\u0627\u0641\u062A\u200C\u0647\u0627\u06CC \u0637\u0628\u06CC\u0639\u06CC \u0698\u0627\u067E\u0646\u06CC", image: IMG.decor6, styleSlug: "japandi", room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", tags: ["\u0628\u0627\u0641\u062A", "\u0637\u0628\u06CC\u0639\u06CC"], productIds: ["p3", "p6"] },
  { id: "i7", title: "\u0628\u0648\u0647\u0645\u06CC\u06CC\u0646 \u0631\u0646\u06AF\u06CC\u0646", image: IMG.living3, styleSlug: "boho", room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", tags: ["\u0631\u0646\u06AF\u06CC\u0646", "\u0627\u0644\u06AF\u0648"], productIds: ["p2", "p12", "p15"] },
  { id: "i8", title: "\u0635\u0646\u0639\u062A\u06CC \u0648 \u062C\u0633\u0648\u0631", image: IMG.decor8, styleSlug: "industrial", room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", tags: ["\u0641\u0644\u0632", "\u0686\u0648\u0628"], productIds: ["p5", "p30"] },
  { id: "i9", title: "\u0631\u0648\u0633\u062A\u06CC\u06A9 \u06AF\u0631\u0645", image: IMG.living10, styleSlug: "rustic", room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", tags: ["\u0686\u0648\u0628", "\u06AF\u0631\u0645\u0627"], productIds: ["p12", "p16"] },
  { id: "i10", title: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u0628\u0627\u0632 \u0648 \u0631\u0648\u0634\u0646", image: IMG.living2, styleSlug: "contemporary", room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", tags: ["\u0628\u0627\u0632", "\u0631\u0648\u0634\u0646"], productIds: ["p1", "p11"] },
  { id: "i11", title: "\u0622\u0631\u0627\u0645\u0634 \u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628", image: IMG.bed4, styleSlug: "minimal", room: "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628", tags: ["\u0622\u0631\u0627\u0645", "\u0633\u0627\u062F\u0647"], productIds: ["p19", "p9"] },
  { id: "i12", title: "\u0631\u0648\u0634\u0646\u0627\u06CC\u06CC \u062F\u0646\u062C", image: IMG.bed3, styleSlug: "scandinavian", room: "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628", tags: ["\u0646\u0648\u0631", "\u062F\u0646\u062C"], productIds: ["p9", "p20"] },
  { id: "i13", title: "\u062C\u0632\u0626\u06CC\u0627\u062A \u06AF\u0644\u062F\u0627\u0646 \u0648 \u0628\u0627\u0641\u062A", image: IMG.decor10, styleSlug: "boho", room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", tags: ["\u06AF\u0644\u062F\u0627\u0646", "\u0628\u0627\u0641\u062A"], productIds: ["p12", "p28"] },
  { id: "i14", title: "\u0638\u0631\u0627\u0641\u062A \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644 \u0698\u0627\u067E\u0646\u06CC", image: IMG.decor6, styleSlug: "japandi", room: "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631", tags: ["\u0645\u06CC\u0646\u06CC\u0645\u0627\u0644", "\u0637\u0628\u06CC\u0639\u06CC"], productIds: ["p23", "p25"] },
  { id: "i15", title: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u0645\u062F\u0631\u0646 \u0645\u0639\u0627\u0635\u0631", image: IMG.living8, styleSlug: "contemporary", room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", tags: ["\u0645\u062F\u0631\u0646", "\u0645\u0639\u0627\u0635\u0631"], productIds: ["p29", "p13"] },
  { id: "i16", title: "\u0633\u062A \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0648 \u06AF\u0631\u0645", image: IMG.living9, styleSlug: "classic", room: "\u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC", tags: ["\u06A9\u0644\u0627\u0633\u06CC\u06A9", "\u06AF\u0631\u0645"], productIds: ["p4", "p5"] },
  { id: "i17", title: "\u0628\u0627\u0644\u06A9\u0646 \u0633\u0628\u0632 \u0648 \u0622\u0631\u0627\u0645", image: IMG.living5, styleSlug: "modern", room: "\u0628\u06CC\u0631\u0648\u0646\u06CC", tags: ["\u0633\u0628\u0632", "\u0628\u0627\u0644\u06A9\u0646"], productIds: ["p27", "p28"] },
  { id: "i18", title: "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631 \u0628\u0627 \u062A\u0645\u0631\u06A9\u0632", image: IMG.decor7, styleSlug: "minimal", room: "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631", tags: ["\u06A9\u0627\u0631", "\u062A\u0645\u0631\u06A9\u0632"], productIds: ["p23", "p24"] },
  { id: "i19", title: "\u06AF\u0631\u0645\u0627\u06CC\u06CC \u062E\u0627\u06A9\u06CC", image: IMG.decor1, styleSlug: "modern", room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", tags: ["\u062E\u0627\u06A9\u06CC", "\u06AF\u0631\u0645"], productIds: ["p1", "p26"] },
  { id: "i20", title: "\u0631\u0648\u06CC\u0627\u06CC \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC", image: IMG.bed9, styleSlug: "scandinavian", room: "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628", tags: ["\u0622\u0631\u0627\u0645", "\u0631\u0648\u0634\u0646"], productIds: ["p19", "p21"] }
];
var aiDesigns2 = [
  {
    id: "d1",
    mode: "room-redesign",
    title: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u0645\u062F\u0631\u0646 \u0628\u0627\u0632\u0637\u0631\u0627\u062D\u06CC\u200C\u0634\u062F\u0647",
    prompt: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC\u0627\u0645 \u0631\u0627 \u0628\u0627 \u0633\u0628\u06A9 \u0645\u062F\u0631\u0646 \u0648 \u067E\u0627\u0644\u062A \u062E\u0627\u06A9\u06CC \u0628\u0627\u0632\u0637\u0631\u0627\u062D\u06CC \u06A9\u0646",
    style: "modern",
    room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC",
    beforeImage: IMG.living4,
    afterImage: IMG.living2,
    status: "completed",
    createdAt: "\u06F1\u06F4\u06F0\u06F3/\u06F0\u06F8/\u06F1\u06F2",
    creditsUsed: 5,
    products: [
      { label: "\u06A9\u0627\u0646\u0627\u067E\u0647", productId: "p1" },
      { label: "\u0686\u0631\u0627\u063A \u0631\u0648\u0645\u06CC\u0632\u06CC", productId: "p9" },
      { label: "\u0642\u0627\u0644\u06CC\u0686\u0647", productId: "p12" },
      { label: "\u06A9\u0648\u0633\u0646", productId: "p15" }
    ]
  },
  {
    id: "d2",
    mode: "prompt-to-design",
    title: "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628 \u0698\u0627\u067E\u0646\u06CC \u0622\u0631\u0627\u0645",
    prompt: "\u06CC\u06A9 \u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628 \u0628\u0627 \u0633\u0628\u06A9 \u062C\u0627\u067E\u0646\u062F\u06CC \u0648 \u0646\u0648\u0631 \u06AF\u0631\u0645 \u0637\u0631\u0627\u062D\u06CC \u06A9\u0646",
    style: "japandi",
    room: "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628",
    afterImage: IMG.bed4,
    status: "completed",
    createdAt: "\u06F1\u06F4\u06F0\u06F3/\u06F0\u06F8/\u06F1\u06F0",
    creditsUsed: 5,
    products: [
      { label: "\u062A\u062E\u062A", productId: "p19" },
      { label: "\u0686\u0631\u0627\u063A", productId: "p9" },
      { label: "\u0631\u0648\u062A\u062E\u062A\u06CC", productId: "p21" }
    ]
  },
  {
    id: "d3",
    mode: "image-edit",
    title: "\u06AF\u0631\u0645\u200C\u062A\u0631 \u06A9\u0631\u062F\u0646 \u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC",
    prompt: "\u0646\u0648\u0631 \u0648 \u0631\u0646\u06AF \u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u0631\u0627 \u06AF\u0631\u0645\u200C\u062A\u0631 \u06A9\u0646 \u0648 \u06CC\u06A9 \u0641\u0631\u0634 \u0627\u0636\u0627\u0641\u0647 \u06A9\u0646",
    style: "rustic",
    room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC",
    beforeImage: IMG.living7,
    afterImage: IMG.living3,
    status: "completed",
    createdAt: "\u06F1\u06F4\u06F0\u06F3/\u06F0\u06F8/\u06F0\u06F8",
    creditsUsed: 3,
    products: [
      { label: "\u0641\u0631\u0634", productId: "p12" },
      { label: "\u06A9\u0648\u0633\u0646", productId: "p15" }
    ]
  },
  {
    id: "d4",
    mode: "full-concept",
    title: "\u06A9\u0627\u0646\u0633\u067E\u062A \u06A9\u0627\u0645\u0644 \u0641\u0636\u0627\u06CC \u06A9\u0627\u0631",
    prompt: "\u06CC\u06A9 \u0641\u0636\u0627\u06CC \u06A9\u0627\u0631 \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644 \u0628\u0631\u0627\u06CC \u062A\u0645\u0631\u06A9\u0632 \u0628\u0627 \u0628\u0648\u062F\u062C\u0647 \u0645\u062A\u0648\u0633\u0637",
    style: "minimal",
    room: "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631",
    afterImage: IMG.decor7,
    status: "completed",
    createdAt: "\u06F1\u06F4\u06F0\u06F3/\u06F0\u06F8/\u06F0\u06F5",
    creditsUsed: 8,
    products: [
      { label: "\u0645\u06CC\u0632 \u06A9\u0627\u0631", productId: "p23" },
      { label: "\u0635\u0646\u062F\u0644\u06CC", productId: "p24" },
      { label: "\u0686\u0631\u0627\u063A", productId: "p9" }
    ]
  }
];

// src/data/content.ts
var projects2 = [
  { id: "pr1", slug: "warm-living-tehran", title: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u06AF\u0631\u0645 \u062F\u0631 \u0642\u0644\u0628 \u062A\u0647\u0631\u0627\u0646", client: "\u062E\u0627\u0646\u0648\u0627\u062F\u0647 \u0631\u0636\u0627\u06CC\u06CC", cover: IMG.living2, gallery: [IMG.living2, IMG.living6, IMG.decor1], style: "\u0645\u062F\u0631\u0646", room: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC", area: "\u06F3\u06F8 \u0645\u062A\u0631", description: "\u0628\u0627\u0632\u0637\u0631\u0627\u062D\u06CC \u06CC\u06A9 \u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u06A9\u0648\u0686\u06A9 \u0628\u0627 \u062A\u0645\u0631\u06A9\u0632 \u0628\u0631 \u0646\u0648\u0631 \u0637\u0628\u06CC\u0639\u06CC\u060C \u067E\u0627\u0644\u062A \u062E\u0627\u06A9\u06CC \u0648 \u0645\u0628\u0644\u0645\u0627\u0646 \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644 \u0628\u0631\u0627\u06CC \u062D\u0633 \u0648\u0633\u0639\u062A \u0648 \u06AF\u0631\u0645\u0627.", productIds: ["p1", "p9", "p15"] },
  { id: "pr2", slug: "japandi-bedroom", title: "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628 \u0698\u0627\u067E\u0646\u062F\u06CC \u0622\u0631\u0627\u0645", client: "\u062E\u0627\u0646\u0645 \u0627\u062D\u0645\u062F\u06CC", cover: IMG.bed4, gallery: [IMG.bed4, IMG.bed9, IMG.decor6], style: "\u0698\u0627\u067E\u0646\u062F\u06CC", room: "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628", area: "\u06F1\u06F6 \u0645\u062A\u0631", description: "\u0637\u0631\u0627\u062D\u06CC \u06CC\u06A9 \u067E\u0646\u0627\u0647\u06AF\u0627\u0647 \u0622\u0631\u0627\u0645 \u0628\u0627 \u0645\u062A\u0631\u06CC\u0627\u0644 \u062E\u0627\u0645\u060C \u0646\u0648\u0631 \u0645\u0644\u0627\u06CC\u0645 \u0648 \u062E\u0637\u0648\u0637 \u0633\u0627\u062F\u0647 \u0628\u0631\u0627\u06CC \u062E\u0648\u0627\u0628\u06CC \u0639\u0645\u06CC\u0642 \u0648 \u0622\u0631\u0627\u0645\u0634.", productIds: ["p19", "p9", "p21"] },
  { id: "pr3", slug: "minimal-workspace", title: "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631 \u0628\u0627 \u062A\u0645\u0631\u06A9\u0632", client: "\u0622\u0642\u0627\u06CC \u06A9\u0631\u06CC\u0645\u06CC", cover: IMG.decor7, gallery: [IMG.decor7, IMG.decor3], style: "\u0645\u06CC\u0646\u06CC\u0645\u0627\u0644", room: "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631", area: "\u06F9 \u0645\u062A\u0631", description: "\u06CC\u06A9 \u06AF\u0648\u0634\u0647\u200C\u06CC \u06A9\u0627\u0631 \u062E\u0644\u0648\u062A \u0648 \u06A9\u0627\u0631\u0628\u0631\u062F\u06CC \u0628\u0631\u0627\u06CC \u062D\u062F\u0627\u06A9\u062B\u0631 \u062A\u0645\u0631\u06A9\u0632 \u0628\u0627 \u06A9\u0645\u062A\u0631\u06CC\u0646 \u0627\u0636\u0627\u0641\u0627\u062A.", productIds: ["p23", "p24", "p9"] },
  { id: "pr4", slug: "luxury-dining", title: "\u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC \u0644\u0648\u06A9\u0633 \u0648 \u0634\u06A9\u0648\u0647\u0645\u0646\u062F", client: "\u0647\u062A\u0644 \u067E\u0627\u0631\u0633\u06CC\u0627\u0646", cover: IMG.living9, gallery: [IMG.living9, IMG.living2], style: "\u0644\u0648\u06A9\u0633", room: "\u0646\u0627\u0647\u0627\u0631\u062E\u0648\u0631\u06CC", area: "\u06F2\u06F5 \u0645\u062A\u0631", description: "\u0641\u0636\u0627\u06CC\u06CC \u0634\u06A9\u0648\u0647\u0645\u0646\u062F \u0628\u0631\u0627\u06CC \u062C\u0645\u0639\u200C\u0634\u062F\u0646\u200C\u0647\u0627\u06CC \u062E\u0627\u0635 \u0628\u0627 \u062C\u0632\u0626\u06CC\u0627\u062A \u0637\u0644\u0627\u06CC\u06CC \u0648 \u0645\u062A\u0631\u06CC\u0627\u0644 \u0645\u0645\u062A\u0627\u0632.", productIds: ["p4", "p10"] }
];
var articles = [
  { id: "a1", slug: "warm-palette-guide", title: "\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u06A9\u0627\u0645\u0644 \u067E\u0627\u0644\u062A \u0631\u0646\u06AF \u06AF\u0631\u0645 \u0628\u0631\u0627\u06CC \u062E\u0627\u0646\u0647", excerpt: "\u0686\u0637\u0648\u0631 \u0628\u0627 \u0631\u0646\u06AF\u200C\u0647\u0627\u06CC \u062E\u0627\u06A9\u06CC \u0648 \u062A\u0631\u0627\u06A9\u0648\u062A\u0627 \u0641\u0636\u0627\u06CC\u06CC \u062F\u0644\u0646\u0634\u06CC\u0646 \u0628\u0633\u0627\u0632\u06CC\u0645.", cover: IMG.living2, category: "\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u0631\u0646\u06AF", author: "\u062A\u06CC\u0645 Homeino", date: "\u06F1\u06F4\u06F0\u06F3/\u06F0\u06F8/\u06F1\u06F0", readTime: 6, content: ["\u0631\u0646\u06AF \u06AF\u0631\u0645 \u0627\u0648\u0644\u06CC\u0646 \u0686\u06CC\u0632\u06CC \u0627\u0633\u062A \u06A9\u0647 \u062D\u0633 \u062E\u0627\u0646\u0647 \u0628\u0648\u062F\u0646 \u0631\u0627 \u0628\u0647 \u0641\u0636\u0627 \u062A\u0632\u0631\u06CC\u0642 \u0645\u06CC\u200C\u06A9\u0646\u062F. \u067E\u0627\u0644\u062A\u200C\u0647\u0627\u06CC \u0645\u0628\u062A\u0646\u06CC \u0628\u0631 \u06A9\u0631\u0645\u060C \u0634\u0646\u06CC\u060C \u062A\u0631\u0627\u06A9\u0648\u062A\u0627 \u0648 \u0642\u0647\u0648\u0647\u200C\u0627\u06CC\u060C \u062A\u0639\u0627\u062F\u0644\u06CC \u0628\u06CC\u0646 \u0644\u0648\u06A9\u0633 \u0628\u0648\u062F\u0646 \u0648 \u062F\u0644\u0646\u0634\u06CC\u0646\u06CC \u0627\u06CC\u062C\u0627\u062F \u0645\u06CC\u200C\u06A9\u0646\u0646\u062F.", "\u0628\u0631\u0627\u06CC \u0634\u0631\u0648\u0639\u060C \u06CC\u06A9 \u0631\u0646\u06AF \u063A\u0627\u0644\u0628 \u062E\u0646\u062B\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646 \u0648 \u0628\u0627 \u06CC\u06A9 \u0631\u0646\u06AF \u062A\u0627\u06A9\u06CC\u062F\u06CC \u06AF\u0631\u0645 (\u0645\u062B\u0644 \u062A\u0631\u0627\u06A9\u0648\u062A\u0627) \u0622\u0646 \u0631\u0627 \u0632\u0646\u062F\u0647 \u06A9\u0646."] },
  { id: "a2", slug: "small-space-tricks", title: "\u06F1\u06F0 \u062A\u0631\u0641\u0646\u062F \u0628\u0631\u0627\u06CC \u062E\u0627\u0646\u0647\u200C\u0647\u0627\u06CC \u06A9\u0648\u0686\u06A9", excerpt: "\u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0627\u0632 \u06A9\u0645\u062A\u0631\u06CC\u0646 \u0641\u0636\u0627 \u0628\u0627 \u0637\u0631\u0627\u062D\u06CC \u0647\u0648\u0634\u0645\u0646\u062F.", cover: IMG.living8, category: "\u062E\u0627\u0646\u0647 \u06A9\u0648\u0686\u06A9", author: "\u0646\u06AF\u0627\u0631 \u0645\u0631\u0627\u062F\u06CC", date: "\u06F1\u06F4\u06F0\u06F3/\u06F0\u06F8/\u06F0\u06F5", readTime: 5, content: ["\u062F\u0631 \u062E\u0627\u0646\u0647\u200C\u0647\u0627\u06CC \u06A9\u0648\u0686\u06A9\u060C \u0646\u0648\u0631 \u0648 \u0631\u0646\u06AF \u0631\u0648\u0634\u0646 \u062F\u0648 \u062F\u0648\u0633\u062A \u0635\u0645\u06CC\u0645\u06CC\u200C\u0627\u062A \u0647\u0633\u062A\u0646\u062F. \u0622\u06CC\u0646\u0647\u200C\u0647\u0627 \u0647\u0645 \u0641\u0636\u0627\u06CC \u0628\u0635\u0631\u06CC \u0631\u0627 \u06AF\u0633\u062A\u0631\u0634 \u0645\u06CC\u200C\u062F\u0647\u0646\u062F.", "\u0645\u0628\u0644\u0645\u0627\u0646 \u0645\u0627\u0698\u0648\u0644\u0627\u0631 \u0648 \u0686\u0646\u062F\u0645\u0646\u0638\u0648\u0631\u0647 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u0639\u062C\u0632\u0647 \u06A9\u0646\u062F."] },
  { id: "a3", slug: "lighting-basics", title: "\u0627\u0635\u0648\u0644 \u0646\u0648\u0631\u067E\u0631\u062F\u0627\u0632\u06CC \u062F\u0627\u062E\u0644\u06CC", excerpt: "\u0633\u0647 \u0644\u0627\u06CC\u0647\u200C\u06CC \u0646\u0648\u0631 \u06A9\u0647 \u0647\u0631 \u062E\u0627\u0646\u0647\u200C\u0627\u06CC \u0646\u06CC\u0627\u0632 \u062F\u0627\u0631\u062F.", cover: IMG.decor3, category: "\u0646\u0648\u0631\u067E\u0631\u062F\u0627\u0632\u06CC", author: "\u0622\u0631\u0634 \u0631\u0633\u062A\u0645\u06CC", date: "\u06F1\u06F4\u06F0\u06F3/\u06F0\u06F7/\u06F2\u06F8", readTime: 7, content: ["\u0646\u0648\u0631\u067E\u0631\u062F\u0627\u0632\u06CC \u062E\u0648\u0628 \u0633\u0647 \u0644\u0627\u06CC\u0647 \u062F\u0627\u0631\u062F: \u0645\u062D\u06CC\u0637\u06CC\u060C \u0648\u0638\u06CC\u0641\u0647\u200C\u0627\u06CC \u0648 \u062A\u0627\u06A9\u06CC\u062F\u06CC. \u062A\u0631\u06A9\u06CC\u0628 \u0627\u06CC\u0646 \u0633\u0647 \u0641\u0636\u0627\u06CC \u0632\u0646\u062F\u0647\u200C\u0627\u06CC \u0645\u06CC\u200C\u0633\u0627\u0632\u062F."] },
  { id: "a4", slug: "japandi-style", title: "\u0633\u0628\u06A9 \u0698\u0627\u067E\u0646\u062F\u06CC \u0686\u06CC\u0633\u062A\u061F", excerpt: "\u062A\u0644\u0627\u0642\u06CC \u0622\u0631\u0627\u0645\u0634 \u0698\u0627\u067E\u0646 \u0648 \u06AF\u0631\u0645\u0627\u06CC \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC.", cover: IMG.decor6, category: "\u0633\u0628\u06A9\u200C\u0647\u0627", author: "\u062A\u06CC\u0645 Homeino", date: "\u06F1\u06F4\u06F0\u06F3/\u06F0\u06F7/\u06F1\u06F5", readTime: 4, content: ["\u062C\u0627\u067E\u0646\u062F\u06CC \u062A\u0631\u06A9\u06CC\u0628\u06CC \u0627\u0633\u062A \u0627\u0632 \u0645\u06CC\u0646\u06CC\u0645\u0627\u0644\u06CC\u0633\u0645 \u0698\u0627\u067E\u0646\u06CC \u0648 \u06A9\u0627\u0631\u0627\u06CC\u06CC \u0627\u0633\u06A9\u0627\u0646\u062F\u06CC\u0646\u0627\u0648\u06CC\u0627\u06CC\u06CC. \u0646\u062A\u06CC\u062C\u0647: \u062A\u0639\u0627\u062F\u0644\u060C \u0633\u0627\u062F\u06AF\u06CC \u0648 \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u0637\u0628\u06CC\u0639\u062A."] },
  { id: "a5", slug: "rug-choosing", title: "\u0686\u0637\u0648\u0631 \u0641\u0631\u0634 \u0645\u0646\u0627\u0633\u0628 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u0645\u061F", excerpt: "\u0627\u0646\u062F\u0627\u0632\u0647\u060C \u062C\u0646\u0633 \u0648 \u0627\u0644\u06AF\u0648\u06CC \u0645\u0646\u0627\u0633\u0628 \u0647\u0631 \u0641\u0636\u0627.", cover: IMG.decor10, category: "\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u062E\u0631\u06CC\u062F", author: "\u0633\u0627\u0631\u0627 \u06A9\u0627\u0638\u0645\u06CC", date: "\u06F1\u06F4\u06F0\u06F3/\u06F0\u06F7/\u06F0\u06F1", readTime: 5, content: ["\u06CC\u06A9 \u0641\u0631\u0634 \u062F\u0631\u0633\u062A \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647\u060C \u0641\u0636\u0627\u06CC\u06CC \u0631\u0627 \u062A\u0639\u0631\u06CC\u0641 \u0645\u06CC\u200C\u06A9\u0646\u062F. \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06CC \u0641\u0631\u0634 \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u067E\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u062C\u0644\u0648\u06CC\u06CC \u0645\u0628\u0644\u0645\u0627\u0646 \u0631\u0627 \u067E\u0648\u0634\u0634 \u062F\u0647\u062F."] },
  { id: "a6", slug: "mixing-styles", title: "\u062A\u0631\u06A9\u06CC\u0628 \u0633\u0628\u06A9\u200C\u0647\u0627 \u0628\u062F\u0648\u0646 \u0634\u0644\u0648\u063A\u06CC", excerpt: "\u0686\u0637\u0648\u0631 \u0645\u062F\u0631\u0646 \u0648 \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0631\u0627 \u0628\u0627 \u0647\u0645 \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u06CC\u0645.", cover: IMG.living3, category: "\u0633\u0628\u06A9\u200C\u0647\u0627", author: "\u062A\u06CC\u0645 Homeino", date: "\u06F1\u06F4\u06F0\u06F3/\u06F0\u06F6/\u06F2\u06F0", readTime: 6, content: ["\u062A\u0631\u06A9\u06CC\u0628 \u0633\u0628\u06A9\u200C\u0647\u0627 \u0647\u0646\u0631 \u0627\u0633\u062A. \u0642\u0627\u0646\u0648\u0646 \u06F8\u06F0/\u06F2\u06F0 \u0631\u0627 \u0631\u0639\u0627\u06CC\u062A \u06A9\u0646: \u06F8\u06F0\u066A \u06CC\u06A9 \u0633\u0628\u06A9 \u063A\u0627\u0644\u0628 \u0648 \u06F2\u06F0\u066A \u0633\u0628\u06A9 \u0645\u06A9\u0645\u0644."] }
];
var projectCollections = [
  { id: "pc1", slug: "warm-living", title: "\u067E\u0630\u06CC\u0631\u0627\u06CC\u06CC \u06AF\u0631\u0645", subtitle: "\u067E\u0627\u0644\u062A \u062E\u0627\u06A9\u06CC \u0648 \u0646\u0648\u0631 \u062F\u0644\u0646\u0634\u06CC\u0646", image: IMG.living2, count: 12 },
  { id: "pc2", slug: "calm-bedroom", title: "\u0627\u062A\u0627\u0642 \u062E\u0648\u0627\u0628 \u0622\u0631\u0627\u0645", subtitle: "\u0622\u0631\u0627\u0645\u0634 \u0639\u0645\u06CC\u0642", image: IMG.bed4, count: 9 },
  { id: "pc3", slug: "focus-space", title: "\u0641\u0636\u0627\u06CC \u062A\u0645\u0631\u06A9\u0632", subtitle: "\u06A9\u0627\u0631 \u0628\u0627 \u0628\u0647\u0631\u0647\u200C\u0648\u0631\u06CC", image: IMG.decor7, count: 7 }
];

// scripts/seed-catalog.ts
dotenv.config();
var det = (key) => {
  const h = crypto2.createHash("md5").update(`homeino:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
var TABLES = { vendors, categories, styles, products, inspirations, projects, articles: magazineArticles, collections };
var SLUG_COL = { vendors: vendors.slug, categories: categories.slug, styles: styles.slug, products: products.slug, inspirations: inspirations.slug, projects: projects.slug, articles: magazineArticles.slug, collections: collections.slug };
var ID_COL = { vendors: vendors.id, categories: categories.id, styles: styles.id, products: products.id, inspirations: inspirations.id, projects: projects.id, articles: magazineArticles.id, collections: collections.id };
async function upsertBySlug(table, slug, values, idKey) {
  const db = getDb();
  const t = TABLES[table];
  const rows = await db.select({ id: ID_COL[table] }).from(t).where(eq(SLUG_COL[table], slug)).limit(1);
  if (rows[0]) {
    await db.update(t).set(values).where(eq(ID_COL[table], rows[0].id));
    return rows[0].id;
  }
  const id2 = det(idKey);
  await db.insert(t).values({ id: id2, ...values });
  return id2;
}
async function main() {
  const db = getDb();
  const log = (...a) => console.log("[seed]", ...a);
  const vendorIdByStoreId = /* @__PURE__ */ new Map();
  for (const s of stores) {
    const id2 = await upsertBySlug("vendors", s.slug, {
      name: s.name,
      slug: s.slug,
      logo: s.logo,
      cover: s.cover,
      description: s.description,
      status: "active",
      verificationStatus: s.verified ? "verified" : "unverified",
      rating: s.rating.toFixed(2),
      reviewsCount: s.reviewsCount,
      salesCount: s.salesCount,
      followersCount: s.followersCount,
      sinceYear: s.sinceYear,
      city: s.city,
      badges: s.badges,
      shippingPolicy: s.shippingPolicy,
      returnPolicy: s.returnPolicy,
      responseTime: s.responseTime,
      metadata: {
        logoColor: s.logoColor,
        trending: Boolean(s.trending),
        isNew: Boolean(s.isNew),
        categorySlugs: s.categorySlugs,
        productCount: s.productCount
      }
    }, `vendor:${s.slug}`);
    vendorIdByStoreId.set(s.id, id2);
  }
  log(`vendors: ${stores.length}`);
  const categoryIdBySlug = /* @__PURE__ */ new Map();
  let catCount = 0;
  for (const [i, c] of categories2.entries()) {
    const rootId = await upsertBySlug("categories", c.slug, {
      slug: c.slug,
      name: c.name,
      nameEn: c.nameEn,
      description: c.description,
      icon: c.icon,
      image: c.image,
      sortOrder: i + 1,
      depth: 0,
      path: "/",
      isActive: true
    }, `category:${c.slug}`);
    categoryIdBySlug.set(c.slug, rootId);
    catCount++;
    for (const [j, sub] of (c.subcategories ?? []).entries()) {
      if (categoryIdBySlug.has(sub.slug)) continue;
      const subId = await upsertBySlug("categories", sub.slug, {
        slug: sub.slug,
        name: sub.name,
        parentId: rootId,
        sortOrder: j + 1,
        depth: 1,
        path: `/${rootId}/`,
        isActive: true
      }, `category:${sub.slug}`);
      categoryIdBySlug.set(sub.slug, subId);
      catCount++;
    }
  }
  log(`categories: ${catCount}`);
  for (const st of styles2) {
    const styleId = await upsertBySlug("styles", st.slug, {
      slug: st.slug,
      name: st.name,
      nameEn: st.nameEn,
      tagline: st.tagline,
      shortDescription: st.shortDescription,
      description: st.description,
      image: st.image,
      imageAlt: st.imageAlt,
      furnitureCharacteristics: st.furnitureCharacteristics,
      lightingCharacteristics: st.lightingCharacteristics,
      formCharacteristics: st.formCharacteristics,
      decorCharacteristics: st.decorCharacteristics,
      visualDensity: st.visualDensity,
      suitableFor: st.suitableFor,
      suitableRooms: st.suitableRooms,
      comparisonNote: st.comparisonNote,
      isPublished: true
    }, `style:${st.slug}`);
    await db.delete(styleFeatures).where(eq(styleFeatures.styleId, styleId));
    await db.delete(styleMaterials).where(eq(styleMaterials.styleId, styleId));
    await db.delete(styleColors).where(eq(styleColors.styleId, styleId));
    if (st.keyFeatures?.length) {
      await db.insert(styleFeatures).values(st.keyFeatures.map((f, i) => ({ styleId, feature: f, position: i + 1 })));
    }
    if (st.materials?.length) {
      await db.insert(styleMaterials).values(st.materials.map((m, i) => ({ styleId, material: m, position: i + 1 })));
    }
    if (st.colorPalette?.length) {
      await db.insert(styleColors).values(st.colorPalette.map((c, i) => ({ id: det(`style-color:${st.slug}:${c.name}`), styleId, name: c.name, hex: c.hex, position: i + 1 })));
    }
  }
  log(`styles: ${styles2.length}`);
  const productIdByMockId = /* @__PURE__ */ new Map();
  for (const p2 of products2) {
    const vendorId = vendorIdByStoreId.get(p2.storeId);
    if (!vendorId) throw new Error(`product ${p2.slug}: unknown storeId ${p2.storeId}`);
    const productId = await upsertBySlug("products", p2.slug, {
      vendorId,
      title: p2.name,
      slug: p2.slug,
      description: p2.description,
      shortDescription: p2.description.slice(0, 380),
      price: p2.price,
      compareAtPrice: p2.oldPrice ?? null,
      currency: "IRT",
      brand: p2.brand,
      sku: p2.sku ?? null,
      color: p2.colors[0]?.name ?? null,
      material: p2.materials[0] ?? null,
      dimensions: { display: p2.dimensions ?? null },
      status: p2.inStock ? "active" : "out_of_stock",
      styleSlugs: p2.styleSlugs,
      tags: p2.tags,
      rating: Math.round(p2.rating * 10),
      reviewsCount: p2.reviewsCount,
      salesCount: p2.salesCount ?? p2.purchaseCount ?? 0,
      metadata: {
        aiRecommended: Boolean(p2.aiRecommended),
        isNew: Boolean(p2.isNew),
        trending: Boolean(p2.trending),
        discount: p2.discount ?? null,
        subCategorySlug: p2.subCategorySlug ?? null,
        categorySlug: p2.categorySlug,
        colors: p2.colors,
        materials: p2.materials,
        specs: p2.specs,
        purchaseCount: p2.purchaseCount ?? 0
      }
    }, `product:${p2.slug}`);
    productIdByMockId.set(p2.id, productId);
    await db.delete(productImages).where(eq(productImages.productId, productId));
    await db.delete(productVariants).where(eq(productVariants.productId, productId));
    await db.delete(productCategories).where(eq(productCategories.productId, productId));
    await db.delete(productStyles).where(eq(productStyles.productId, productId));
    await db.delete(inventory).where(eq(inventory.productId, productId));
    if (p2.images.length) {
      await db.insert(productImages).values(p2.images.map((url, i) => ({
        id: det(`pimg:${p2.slug}:${i}`),
        productId,
        url,
        alt: p2.name,
        position: i,
        isPrimary: i === 0
      })));
    }
    if (p2.colors.length) {
      await db.insert(productVariants).values(p2.colors.map((c, i) => ({
        id: det(`pvar:${p2.slug}:${c.name}`),
        productId,
        name: c.name,
        sku: p2.sku ? `${p2.sku}-${i + 1}` : null,
        attributes: { hex: c.hex },
        image: p2.images[0] ?? null,
        isActive: true
      })));
    }
    const catLinks = [];
    const primaryCat = categoryIdBySlug.get(p2.categorySlug);
    if (primaryCat) catLinks.push({ productId, categoryId: primaryCat, isPrimary: true });
    const subCat = p2.subCategorySlug ? categoryIdBySlug.get(p2.subCategorySlug) : void 0;
    if (subCat && subCat !== primaryCat) catLinks.push({ productId, categoryId: subCat, isPrimary: false });
    if (catLinks.length) await db.insert(productCategories).values(catLinks);
    if (p2.styleSlugs.length) {
      await db.insert(productStyles).values(p2.styleSlugs.map((slug) => ({ productId, styleSlug: slug })));
    }
    await db.insert(inventory).values({
      id: det(`inv:${p2.slug}`),
      productId,
      quantity: Math.max(0, p2.stockCount ?? (p2.inStock ? 25 : 0)),
      reservedQuantity: 0,
      warehouse: "main"
    });
  }
  log(`products: ${products2.length}`);
  for (const insp of inspirations2) {
    await upsertBySlug("inspirations", insp.id, {
      slug: insp.id,
      title: insp.title,
      image: insp.image,
      styleSlug: insp.styleSlug,
      room: insp.room,
      tags: insp.tags,
      productIds: insp.productIds.map((pid) => productIdByMockId.get(pid)).filter(Boolean),
      content: {},
      status: "published"
    }, `inspiration:${insp.id}`);
  }
  log(`inspirations: ${inspirations2.length}`);
  for (const pr of projects2) {
    await upsertBySlug("projects", pr.slug, {
      slug: pr.slug,
      title: pr.title,
      cover: pr.cover,
      description: pr.description,
      content: {
        client: pr.client,
        gallery: pr.gallery,
        style: pr.style,
        room: pr.room,
        area: pr.area,
        productIds: pr.productIds.map((pid) => productIdByMockId.get(pid)).filter(Boolean)
      },
      status: "published"
    }, `project:${pr.slug}`);
  }
  log(`projects: ${projects2.length}`);
  for (const a of articles) {
    await upsertBySlug("articles", a.slug, {
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      cover: a.cover,
      body: (a.content ?? []).join("\n\n"),
      category: a.category,
      tags: [a.author, `${a.readTime} \u062F\u0642\u06CC\u0642\u0647`, a.date].filter(Boolean),
      status: "published"
    }, `article:${a.slug}`);
  }
  log(`articles: ${articles.length}`);
  for (const c of projectCollections) {
    const collectionId = await upsertBySlug("collections", c.slug, {
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      image: c.image,
      isPublic: true
    }, `collection:${c.slug}`);
    await db.delete(collectionProducts).where(eq(collectionProducts.collectionId, collectionId));
    const preview = products2.filter((p2) => p2.trending).slice(0, Math.max(1, c.count));
    if (preview.length) {
      const ids = preview.map((p2) => productIdByMockId.get(p2.id)).filter(Boolean);
      if (ids.length) await db.insert(collectionProducts).values(ids.map((productId) => ({ collectionId, productId })));
    }
  }
  log(`collections: ${projectCollections.length}`);
  for (const t of ["vendors", "categories", "styles", "products", "inspirations", "projects", "articles", "collections"]) {
    const n = await db.select({ id: ID_COL[t] }).from(TABLES[t]).limit(500);
    log(`${t} in DB:`, n.length);
  }
  log("DONE \u2705");
}
main().then(() => process.exit(0)).catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
