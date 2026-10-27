--
-- PostgreSQL database dump
--

\restrict Xd3eR28BoYfBCTEJy8rMUR55extPh3Oe5GvI810P6P3Z1UT5V3o020l8FTWGHoK

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

-- Started on 2026-10-27 07:19:31

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2168 (class 3456 OID 1171753)
-- Name: kurdish; Type: COLLATION; Schema: public; Owner: postgres
--

CREATE COLLATION public.kurdish (provider = icu, locale = 'ckb');


ALTER COLLATION public.kurdish OWNER TO postgres;

--
-- TOC entry 240 (class 1255 OID 1171754)
-- Name: normalize_digits(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.normalize_digits(input text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
    SELECT translate(
        input,
        U&'\0660\0661\0662\0663\0664\0665\0666\0667\0668\0669\06F0\06F1\06F2\06F3\06F4\06F5\06F6\06F7\06F8\06F9',
        '01234567890123456789'
    )
$$;


ALTER FUNCTION public.normalize_digits(input text) OWNER TO postgres;

--
-- TOC entry 242 (class 1255 OID 1171757)
-- Name: normalize_text(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.normalize_text(input text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
    SELECT lower(
        btrim(
            regexp_replace(
                regexp_replace(
                    translate(
                        normalize_digits(input),
                        U&'\064A\0649\0643\06BE\0623\0625\0622\0671\0629',
                        U&'\06CC\06CC\06A9\0647\0627\0627\0627\0627\0647'
                    ),
                    '[\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E]',
                    '',
                    'g'
                ),
                '\s+',
                ' ',
                'g'
            )
        )
    )
$$;


ALTER FUNCTION public.normalize_text(input text) OWNER TO postgres;

--
-- TOC entry 241 (class 1255 OID 1171756)
-- Name: parse_number(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.parse_number(input text) RETURNS numeric
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $_$
    SELECT CASE
        WHEN t.cleaned ~ '^-?[0-9]+(\.[0-9]+)?$' THEN t.cleaned::NUMERIC
        ELSE NULL
    END
    FROM (
        SELECT regexp_replace(
            replace(
                replace(normalize_digits(input), U&'\066B', '.'),
                U&'\066C',
                ''
            ),
            '[,\s]',
            '',
            'g'
        ) AS cleaned
    ) t
$_$;


ALTER FUNCTION public.parse_number(input text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 235 (class 1259 OID 1180049)
-- Name: customer_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_payments (
    payment_id integer NOT NULL,
    customer_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    paid_on date DEFAULT CURRENT_DATE NOT NULL,
    note character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_payments_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.customer_payments OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 1180048)
-- Name: customer_payments_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_payments_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_payments_payment_id_seq OWNER TO postgres;

--
-- TOC entry 5134 (class 0 OID 0)
-- Dependencies: 234
-- Name: customer_payments_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_payments_payment_id_seq OWNED BY public.customer_payments.payment_id;


--
-- TOC entry 233 (class 1259 OID 1180031)
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    customer_id integer NOT NULL,
    name character varying(150) NOT NULL,
    phone character varying(30),
    address character varying(255),
    notes text,
    search_text text GENERATED ALWAYS AS (public.normalize_text((((name)::text || ' '::text) || (COALESCE(phone, ''::character varying))::text))) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customers_name_check CHECK ((btrim((name)::text) <> ''::text))
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 1180030)
-- Name: customers_customer_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_customer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_customer_id_seq OWNER TO postgres;

--
-- TOC entry 5135 (class 0 OID 0)
-- Dependencies: 232
-- Name: customers_customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_customer_id_seq OWNED BY public.customers.customer_id;


--
-- TOC entry 229 (class 1259 OID 1180021)
-- Name: legacy_iqd_product_units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.legacy_iqd_product_units (
    unit_id integer,
    product_id integer,
    unit_name character varying(50),
    price_iqd numeric(14,0),
    price_usd numeric(12,2)
);


ALTER TABLE public.legacy_iqd_product_units OWNER TO postgres;

--
-- TOC entry 5136 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE legacy_iqd_product_units; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.legacy_iqd_product_units IS 'Original product prices before the USD-only migration (003).';


--
-- TOC entry 231 (class 1259 OID 1180027)
-- Name: legacy_iqd_wasl_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.legacy_iqd_wasl_items (
    wasl_item_id integer,
    wasl_id integer,
    unit_price numeric(14,2),
    price_iqd numeric(14,2),
    price_usd numeric(12,2),
    subtotal numeric(14,2)
);


ALTER TABLE public.legacy_iqd_wasl_items OWNER TO postgres;

--
-- TOC entry 5137 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE legacy_iqd_wasl_items; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.legacy_iqd_wasl_items IS 'Original wasl item amounts before the USD-only migration (003).';


--
-- TOC entry 230 (class 1259 OID 1180024)
-- Name: legacy_iqd_wasls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.legacy_iqd_wasls (
    wasl_id integer,
    currency character(3),
    exchange_rate numeric(12,2),
    subtotal numeric(14,2),
    discount numeric(14,2),
    total numeric(14,2),
    other_total numeric(14,2),
    total_iqd numeric(14,2),
    total_usd numeric(14,2)
);


ALTER TABLE public.legacy_iqd_wasls OWNER TO postgres;

--
-- TOC entry 5138 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE legacy_iqd_wasls; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.legacy_iqd_wasls IS 'Original wasl amounts (in each wasl currency) before the USD-only migration (003).';


--
-- TOC entry 223 (class 1259 OID 1171803)
-- Name: product_units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_units (
    unit_id integer NOT NULL,
    product_id integer NOT NULL,
    unit_name character varying(50) NOT NULL,
    price_usd numeric(12,2) NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    stock_quantity numeric(12,3),
    CONSTRAINT product_units_price_usd_check CHECK ((price_usd >= (0)::numeric)),
    CONSTRAINT product_units_stock_quantity_check CHECK (((stock_quantity IS NULL) OR (stock_quantity >= (0)::numeric))),
    CONSTRAINT product_units_unit_name_check CHECK ((btrim((unit_name)::text) <> ''::text))
);


ALTER TABLE public.product_units OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 1171802)
-- Name: product_units_unit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_units_unit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_units_unit_id_seq OWNER TO postgres;

--
-- TOC entry 5139 (class 0 OID 0)
-- Dependencies: 222
-- Name: product_units_unit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_units_unit_id_seq OWNED BY public.product_units.unit_id;


--
-- TOC entry 221 (class 1259 OID 1171785)
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    product_id integer NOT NULL,
    name character varying(150) NOT NULL,
    search_text text GENERATED ALWAYS AS (public.normalize_text((name)::text)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_name_check CHECK ((btrim((name)::text) <> ''::text))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 1171784)
-- Name: products_product_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_product_id_seq OWNER TO postgres;

--
-- TOC entry 5140 (class 0 OID 0)
-- Dependencies: 220
-- Name: products_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_product_id_seq OWNED BY public.products.product_id;


--
-- TOC entry 228 (class 1259 OID 1180013)
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schema_migrations (
    name character varying(200) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 1171775)
-- Name: settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settings (
    key character varying(50) NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.settings OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 1171855)
-- Name: wasl_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wasl_items (
    wasl_item_id integer NOT NULL,
    wasl_id integer NOT NULL,
    product_id integer,
    product_name character varying(150) NOT NULL,
    unit_name character varying(50),
    quantity numeric(12,3) NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    subtotal numeric(14,2) NOT NULL,
    unit_id integer,
    returned_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    CONSTRAINT wasl_items_product_name_check CHECK ((btrim((product_name)::text) <> ''::text)),
    CONSTRAINT wasl_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT wasl_items_returned_within_quantity CHECK (((returned_quantity >= (0)::numeric) AND (returned_quantity <= quantity))),
    CONSTRAINT wasl_items_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT wasl_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE public.wasl_items OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 1171854)
-- Name: wasl_items_wasl_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wasl_items_wasl_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wasl_items_wasl_item_id_seq OWNER TO postgres;

--
-- TOC entry 5141 (class 0 OID 0)
-- Dependencies: 226
-- Name: wasl_items_wasl_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wasl_items_wasl_item_id_seq OWNED BY public.wasl_items.wasl_item_id;


--
-- TOC entry 239 (class 1259 OID 1212755)
-- Name: wasl_return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wasl_return_items (
    return_item_id integer NOT NULL,
    return_id integer NOT NULL,
    wasl_item_id integer NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    amount numeric(14,2) NOT NULL,
    CONSTRAINT wasl_return_items_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT wasl_return_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT wasl_return_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE public.wasl_return_items OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 1212754)
-- Name: wasl_return_items_return_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wasl_return_items_return_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wasl_return_items_return_item_id_seq OWNER TO postgres;

--
-- TOC entry 5142 (class 0 OID 0)
-- Dependencies: 238
-- Name: wasl_return_items_return_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wasl_return_items_return_item_id_seq OWNED BY public.wasl_return_items.return_item_id;


--
-- TOC entry 237 (class 1259 OID 1212723)
-- Name: wasl_returns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wasl_returns (
    return_id integer NOT NULL,
    wasl_id integer NOT NULL,
    request_id character varying(100) NOT NULL,
    goods_amount numeric(14,2) NOT NULL,
    net_amount numeric(14,2) NOT NULL,
    debt_reduction numeric(14,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    note character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wasl_returns_debt_reduction_check CHECK ((debt_reduction >= (0)::numeric)),
    CONSTRAINT wasl_returns_goods_amount_check CHECK ((goods_amount >= (0)::numeric)),
    CONSTRAINT wasl_returns_net_amount_check CHECK ((net_amount >= (0)::numeric)),
    CONSTRAINT wasl_returns_net_is_debt_plus_refund CHECK ((net_amount = (debt_reduction + refund_amount))),
    CONSTRAINT wasl_returns_refund_amount_check CHECK ((refund_amount >= (0)::numeric))
);


ALTER TABLE public.wasl_returns OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 1212722)
-- Name: wasl_returns_return_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wasl_returns_return_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wasl_returns_return_id_seq OWNER TO postgres;

--
-- TOC entry 5143 (class 0 OID 0)
-- Dependencies: 236
-- Name: wasl_returns_return_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wasl_returns_return_id_seq OWNED BY public.wasl_returns.return_id;


--
-- TOC entry 225 (class 1259 OID 1171825)
-- Name: wasls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wasls (
    wasl_id integer NOT NULL,
    customer_name character varying(150),
    subtotal numeric(14,2) NOT NULL,
    discount numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_id integer,
    sale_type character varying(10) DEFAULT 'cash'::character varying NOT NULL,
    CONSTRAINT wasls_credit_has_customer CHECK ((((sale_type)::text = 'cash'::text) OR (customer_id IS NOT NULL))),
    CONSTRAINT wasls_credit_has_no_discount CHECK ((((sale_type)::text = 'cash'::text) OR (discount = (0)::numeric))),
    CONSTRAINT wasls_discount_check CHECK ((discount >= (0)::numeric)),
    CONSTRAINT wasls_sale_type_check CHECK (((sale_type)::text = ANY ((ARRAY['cash'::character varying, 'credit'::character varying])::text[]))),
    CONSTRAINT wasls_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT wasls_total_check CHECK ((total >= (0)::numeric))
);


ALTER TABLE public.wasls OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 1171824)
-- Name: wasls_wasl_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wasls_wasl_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wasls_wasl_id_seq OWNER TO postgres;

--
-- TOC entry 5144 (class 0 OID 0)
-- Dependencies: 224
-- Name: wasls_wasl_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wasls_wasl_id_seq OWNED BY public.wasls.wasl_id;


--
-- TOC entry 4885 (class 2604 OID 1180052)
-- Name: customer_payments payment_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_payments ALTER COLUMN payment_id SET DEFAULT nextval('public.customer_payments_payment_id_seq'::regclass);


--
-- TOC entry 4881 (class 2604 OID 1180034)
-- Name: customers customer_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN customer_id SET DEFAULT nextval('public.customers_customer_id_seq'::regclass);


--
-- TOC entry 4872 (class 2604 OID 1171806)
-- Name: product_units unit_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_units ALTER COLUMN unit_id SET DEFAULT nextval('public.product_units_unit_id_seq'::regclass);


--
-- TOC entry 4868 (class 2604 OID 1171788)
-- Name: products product_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN product_id SET DEFAULT nextval('public.products_product_id_seq'::regclass);


--
-- TOC entry 4878 (class 2604 OID 1171858)
-- Name: wasl_items wasl_item_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_items ALTER COLUMN wasl_item_id SET DEFAULT nextval('public.wasl_items_wasl_item_id_seq'::regclass);


--
-- TOC entry 4892 (class 2604 OID 1212758)
-- Name: wasl_return_items return_item_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_return_items ALTER COLUMN return_item_id SET DEFAULT nextval('public.wasl_return_items_return_item_id_seq'::regclass);


--
-- TOC entry 4888 (class 2604 OID 1212726)
-- Name: wasl_returns return_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_returns ALTER COLUMN return_id SET DEFAULT nextval('public.wasl_returns_return_id_seq'::regclass);


--
-- TOC entry 4874 (class 2604 OID 1171828)
-- Name: wasls wasl_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasls ALTER COLUMN wasl_id SET DEFAULT nextval('public.wasls_wasl_id_seq'::regclass);


--
-- TOC entry 5124 (class 0 OID 1180049)
-- Dependencies: 235
-- Data for Name: customer_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_payments (payment_id, customer_id, amount, paid_on, note, created_at) FROM stdin;
2	2	20.00	2026-10-15	\N	2026-10-15 13:48:32.621218+03
\.


--
-- TOC entry 5122 (class 0 OID 1180031)
-- Dependencies: 233
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (customer_id, name, phone, address, notes, created_at, updated_at) FROM stdin;
2	hemn	07718839403	slemani taza	...	2026-10-15 13:41:17.711461+03	2026-10-15 13:41:17.711461+03
\.


--
-- TOC entry 5118 (class 0 OID 1180021)
-- Dependencies: 229
-- Data for Name: legacy_iqd_product_units; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.legacy_iqd_product_units (unit_id, product_id, unit_name, price_iqd, price_usd) FROM stdin;
1	3	دانە	\N	20.00
\.


--
-- TOC entry 5120 (class 0 OID 1180027)
-- Dependencies: 231
-- Data for Name: legacy_iqd_wasl_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.legacy_iqd_wasl_items (wasl_item_id, wasl_id, unit_price, price_iqd, price_usd, subtotal) FROM stdin;
4	4	20.00	33200.00	20.00	60.00
\.


--
-- TOC entry 5119 (class 0 OID 1180024)
-- Dependencies: 230
-- Data for Name: legacy_iqd_wasls; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.legacy_iqd_wasls (wasl_id, currency, exchange_rate, subtotal, discount, total, other_total, total_iqd, total_usd) FROM stdin;
4	USD	1660.00	60.00	0.00	60.00	99600.00	99600.00	60.00
\.


--
-- TOC entry 5112 (class 0 OID 1171803)
-- Dependencies: 223
-- Data for Name: product_units; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_units (unit_id, product_id, unit_name, price_usd, "position", stock_quantity) FROM stdin;
1	3	دانە	20.00	0	\N
\.


--
-- TOC entry 5110 (class 0 OID 1171785)
-- Dependencies: 221
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (product_id, name, created_at, updated_at) FROM stdin;
3	shisha	2026-10-14 09:13:09.4779+03	2026-10-14 09:13:09.4779+03
\.


--
-- TOC entry 5117 (class 0 OID 1180013)
-- Dependencies: 228
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.schema_migrations (name, applied_at) FROM stdin;
003_usd_only_and_customers.sql	2026-10-15 13:38:05.887256+03
004_stock_and_returns.sql	2026-10-21 12:17:11.58834+03
\.


--
-- TOC entry 5108 (class 0 OID 1171775)
-- Dependencies: 219
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.settings (key, value) FROM stdin;
\.


--
-- TOC entry 5116 (class 0 OID 1171855)
-- Dependencies: 227
-- Data for Name: wasl_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wasl_items (wasl_item_id, wasl_id, product_id, product_name, unit_name, quantity, unit_price, subtotal, unit_id, returned_quantity) FROM stdin;
8	11	3	shisha	دانە	4.000	20.00	80.00	1	0.000
6	9	3	shisha	دانە	3.000	20.00	60.00	1	1.000
7	10	3	shisha	دانە	4.000	20.00	80.00	1	4.000
\.


--
-- TOC entry 5128 (class 0 OID 1212755)
-- Dependencies: 239
-- Data for Name: wasl_return_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wasl_return_items (return_item_id, return_id, wasl_item_id, quantity, unit_price, amount) FROM stdin;
3	5	6	1.000	20.00	20.00
4	6	7	4.000	20.00	80.00
\.


--
-- TOC entry 5126 (class 0 OID 1212723)
-- Dependencies: 237
-- Data for Name: wasl_returns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wasl_returns (return_id, wasl_id, request_id, goods_amount, net_amount, debt_reduction, refund_amount, note, created_at) FROM stdin;
5	9	6dbd33ac-c7d7-4ed7-b0d3-bc5a9f92ef2b	20.00	20.00	20.00	0.00	\N	2026-10-21 12:19:58.43414+03
6	10	9d0d002e-2540-46b3-97dc-3fef3e489468	80.00	80.00	80.00	0.00	\N	2026-10-21 12:20:56.271686+03
\.


--
-- TOC entry 5114 (class 0 OID 1171825)
-- Dependencies: 225
-- Data for Name: wasls; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wasls (wasl_id, customer_name, subtotal, discount, total, created_at, customer_id, sale_type) FROM stdin;
9	hemn	60.00	0.00	60.00	2026-10-15 13:47:23.988572+03	2	credit
10	hemn	80.00	0.00	80.00	2026-10-15 13:58:56.775799+03	2	credit
11	hemn	80.00	0.00	80.00	2026-10-15 13:59:11.214473+03	2	credit
\.


--
-- TOC entry 5145 (class 0 OID 0)
-- Dependencies: 234
-- Name: customer_payments_payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_payments_payment_id_seq', 4, true);


--
-- TOC entry 5146 (class 0 OID 0)
-- Dependencies: 232
-- Name: customers_customer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_customer_id_seq', 3, true);


--
-- TOC entry 5147 (class 0 OID 0)
-- Dependencies: 222
-- Name: product_units_unit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_units_unit_id_seq', 4, true);


--
-- TOC entry 5148 (class 0 OID 0)
-- Dependencies: 220
-- Name: products_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_product_id_seq', 7, true);


--
-- TOC entry 5149 (class 0 OID 0)
-- Dependencies: 226
-- Name: wasl_items_wasl_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wasl_items_wasl_item_id_seq', 10, true);


--
-- TOC entry 5150 (class 0 OID 0)
-- Dependencies: 238
-- Name: wasl_return_items_return_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wasl_return_items_return_item_id_seq', 4, true);


--
-- TOC entry 5151 (class 0 OID 0)
-- Dependencies: 236
-- Name: wasl_returns_return_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wasl_returns_return_id_seq', 6, true);


--
-- TOC entry 5152 (class 0 OID 0)
-- Dependencies: 224
-- Name: wasls_wasl_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wasls_wasl_id_seq', 16, true);


--
-- TOC entry 4940 (class 2606 OID 1180062)
-- Name: customer_payments customer_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_pkey PRIMARY KEY (payment_id);


--
-- TOC entry 4937 (class 2606 OID 1180046)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (customer_id);


--
-- TOC entry 4925 (class 2606 OID 1171817)
-- Name: product_units product_units_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_units
    ADD CONSTRAINT product_units_pkey PRIMARY KEY (unit_id);


--
-- TOC entry 4922 (class 2606 OID 1171800)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (product_id);


--
-- TOC entry 4935 (class 2606 OID 1180020)
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- TOC entry 4919 (class 2606 OID 1171783)
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- TOC entry 4933 (class 2606 OID 1171874)
-- Name: wasl_items wasl_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_items
    ADD CONSTRAINT wasl_items_pkey PRIMARY KEY (wasl_item_id);


--
-- TOC entry 4951 (class 2606 OID 1212769)
-- Name: wasl_return_items wasl_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_return_items
    ADD CONSTRAINT wasl_return_items_pkey PRIMARY KEY (return_item_id);


--
-- TOC entry 4945 (class 2606 OID 1212744)
-- Name: wasl_returns wasl_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_returns
    ADD CONSTRAINT wasl_returns_pkey PRIMARY KEY (return_id);


--
-- TOC entry 4947 (class 2606 OID 1212746)
-- Name: wasl_returns wasl_returns_request_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_returns
    ADD CONSTRAINT wasl_returns_request_id_key UNIQUE (request_id);


--
-- TOC entry 4929 (class 2606 OID 1171847)
-- Name: wasls wasls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasls
    ADD CONSTRAINT wasls_pkey PRIMARY KEY (wasl_id);


--
-- TOC entry 4941 (class 1259 OID 1180068)
-- Name: idx_customer_payments_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_payments_customer ON public.customer_payments USING btree (customer_id, paid_on);


--
-- TOC entry 4938 (class 1259 OID 1180047)
-- Name: idx_customers_search_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_search_text ON public.customers USING btree (search_text);


--
-- TOC entry 4923 (class 1259 OID 1171823)
-- Name: idx_product_units_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_units_product_id ON public.product_units USING btree (product_id);


--
-- TOC entry 4920 (class 1259 OID 1171801)
-- Name: idx_products_search_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_search_text ON public.products USING btree (search_text);


--
-- TOC entry 4930 (class 1259 OID 1212721)
-- Name: idx_wasl_items_unit_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wasl_items_unit_id ON public.wasl_items USING btree (unit_id);


--
-- TOC entry 4931 (class 1259 OID 1171885)
-- Name: idx_wasl_items_wasl_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wasl_items_wasl_id ON public.wasl_items USING btree (wasl_id);


--
-- TOC entry 4948 (class 1259 OID 1212780)
-- Name: idx_wasl_return_items_return_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wasl_return_items_return_id ON public.wasl_return_items USING btree (return_id);


--
-- TOC entry 4949 (class 1259 OID 1212781)
-- Name: idx_wasl_return_items_wasl_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wasl_return_items_wasl_item_id ON public.wasl_return_items USING btree (wasl_item_id);


--
-- TOC entry 4942 (class 1259 OID 1212753)
-- Name: idx_wasl_returns_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wasl_returns_created_at ON public.wasl_returns USING btree (created_at DESC);


--
-- TOC entry 4943 (class 1259 OID 1212752)
-- Name: idx_wasl_returns_wasl_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wasl_returns_wasl_id ON public.wasl_returns USING btree (wasl_id);


--
-- TOC entry 4926 (class 1259 OID 1171853)
-- Name: idx_wasls_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wasls_created_at ON public.wasls USING btree (created_at DESC);


--
-- TOC entry 4927 (class 1259 OID 1180080)
-- Name: idx_wasls_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wasls_customer ON public.wasls USING btree (customer_id, created_at) WHERE (customer_id IS NOT NULL);


--
-- TOC entry 4957 (class 2606 OID 1180063)
-- Name: customer_payments customer_payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE RESTRICT;


--
-- TOC entry 4952 (class 2606 OID 1171818)
-- Name: product_units product_units_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_units
    ADD CONSTRAINT product_units_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id) ON DELETE CASCADE;


--
-- TOC entry 4954 (class 2606 OID 1171880)
-- Name: wasl_items wasl_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_items
    ADD CONSTRAINT wasl_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id) ON DELETE SET NULL;


--
-- TOC entry 4955 (class 2606 OID 1212713)
-- Name: wasl_items wasl_items_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_items
    ADD CONSTRAINT wasl_items_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.product_units(unit_id) ON DELETE SET NULL;


--
-- TOC entry 4956 (class 2606 OID 1171875)
-- Name: wasl_items wasl_items_wasl_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_items
    ADD CONSTRAINT wasl_items_wasl_id_fkey FOREIGN KEY (wasl_id) REFERENCES public.wasls(wasl_id) ON DELETE CASCADE;


--
-- TOC entry 4959 (class 2606 OID 1212770)
-- Name: wasl_return_items wasl_return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_return_items
    ADD CONSTRAINT wasl_return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.wasl_returns(return_id) ON DELETE CASCADE;


--
-- TOC entry 4960 (class 2606 OID 1212775)
-- Name: wasl_return_items wasl_return_items_wasl_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_return_items
    ADD CONSTRAINT wasl_return_items_wasl_item_id_fkey FOREIGN KEY (wasl_item_id) REFERENCES public.wasl_items(wasl_item_id) ON DELETE RESTRICT;


--
-- TOC entry 4958 (class 2606 OID 1212747)
-- Name: wasl_returns wasl_returns_wasl_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasl_returns
    ADD CONSTRAINT wasl_returns_wasl_id_fkey FOREIGN KEY (wasl_id) REFERENCES public.wasls(wasl_id) ON DELETE RESTRICT;


--
-- TOC entry 4953 (class 2606 OID 1180072)
-- Name: wasls wasls_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wasls
    ADD CONSTRAINT wasls_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id) ON DELETE RESTRICT;


-- Completed on 2026-10-27 07:19:32

--
-- PostgreSQL database dump complete
--

\unrestrict Xd3eR28BoYfBCTEJy8rMUR55extPh3Oe5GvI810P6P3Z1UT5V3o020l8FTWGHoK

