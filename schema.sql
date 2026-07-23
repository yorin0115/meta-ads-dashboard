--
-- PostgreSQL database dump
--

\restrict kuiooYS7PSWwDcp2puRK0rIgF1aypFtUKgMskHEbfgutPIeOTZyTuBwF28tCAo2

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ads (
    ad_id character varying(30) NOT NULL,
    adset_id character varying(30) NOT NULL,
    name character varying(255) NOT NULL,
    start_date date NOT NULL
);


ALTER TABLE public.ads OWNER TO postgres;

--
-- Name: adsets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.adsets (
    adset_id character varying(30) NOT NULL,
    campaign_id character varying(30) NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(20) NOT NULL,
    optimization_goal character varying(100) NOT NULL,
    budget numeric(12,2) NOT NULL,
    budget_type character varying(20) NOT NULL,
    start_date date NOT NULL
);


ALTER TABLE public.adsets OWNER TO postgres;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO postgres;

--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaigns (
    campaign_id character varying(30) NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(20) NOT NULL,
    objective character varying(50) NOT NULL,
    budget_type character varying(20) NOT NULL,
    start_date date NOT NULL
);


ALTER TABLE public.campaigns OWNER TO postgres;

--
-- Name: daily_performance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_performance (
    id integer NOT NULL,
    date date NOT NULL,
    ad_id character varying(30) NOT NULL,
    delivery_status character varying(20) NOT NULL,
    cost numeric(12,2) NOT NULL,
    conversions integer NOT NULL,
    reach integer NOT NULL,
    impressions integer NOT NULL,
    clicks integer NOT NULL,
    revenue numeric(12,2)
);


ALTER TABLE public.daily_performance OWNER TO postgres;

--
-- Name: daily_performance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.daily_performance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_performance_id_seq OWNER TO postgres;

--
-- Name: daily_performance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.daily_performance_id_seq OWNED BY public.daily_performance.id;


--
-- Name: daily_performance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_performance ALTER COLUMN id SET DEFAULT nextval('public.daily_performance_id_seq'::regclass);


--
-- Name: ads ads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_pkey PRIMARY KEY (ad_id);


--
-- Name: adsets adsets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.adsets
    ADD CONSTRAINT adsets_pkey PRIMARY KEY (adset_id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (campaign_id);


--
-- Name: daily_performance daily_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_performance
    ADD CONSTRAINT daily_performance_pkey PRIMARY KEY (id);


--
-- Name: daily_performance uq_daily_performance_date_ad; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_performance
    ADD CONSTRAINT uq_daily_performance_date_ad UNIQUE (date, ad_id);


--
-- Name: ads ads_adset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_adset_id_fkey FOREIGN KEY (adset_id) REFERENCES public.adsets(adset_id);


--
-- Name: adsets adsets_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.adsets
    ADD CONSTRAINT adsets_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(campaign_id);


--
-- Name: daily_performance daily_performance_ad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_performance
    ADD CONSTRAINT daily_performance_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES public.ads(ad_id);


--
-- PostgreSQL database dump complete
--

\unrestrict kuiooYS7PSWwDcp2puRK0rIgF1aypFtUKgMskHEbfgutPIeOTZyTuBwF28tCAo2

