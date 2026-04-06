--
-- PostgreSQL database dump
--

\restrict RJeQ9x58IUhQgI0kFkPKVjavHNYrdNWuQ9rDWuntUXQcHWqPRSHcSKr7xOrgjhl

-- Dumped from database version 18.2 (94b8da0)
-- Dumped by pg_dump version 18.1

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
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: audit_action_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_action_enum AS ENUM (
    'OVERRIDE',
    'INSERT',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'APPROVE',
    'CREATE',
    'SECURITY'
);


--
-- Name: ballot_unit_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ballot_unit_status_enum AS ENUM (
    'ACTIVE',
    'MAINTENANCE',
    'INACTIVE'
);


--
-- Name: dispute_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dispute_status_enum AS ENUM (
    'OPEN',
    'RESOLVED'
);


--
-- Name: election_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.election_status_enum AS ENUM (
    'PLANNED',
    'LIVE',
    'CLOSED',
    'FINALIZED'
);


--
-- Name: nomination_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.nomination_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: otp_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.otp_status_enum AS ENUM (
    'ISSUED',
    'USED',
    'EXPIRED'
);


--
-- Name: poll_session_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.poll_session_status_enum AS ENUM (
    'OPEN',
    'CLOSED'
);


--
-- Name: polling_center_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.polling_center_status_enum AS ENUM (
    'OPEN',
    'FLAGGED',
    'CLOSED'
);


--
-- Name: schedule_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.schedule_status_enum AS ENUM (
    'PLANNED',
    'LIVE',
    'CLOSED'
);


--
-- Name: sensitive_request_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sensitive_request_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: user_role_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role_enum AS ENUM (
    'VOTER',
    'ADMIN',
    'PO',
    'RO',
    'PRO',
    'TECH',
    'AGENT',
    'TRIBUNAL_OFFICER',
    'USER'
);


--
-- Name: voter_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.voter_status_enum AS ENUM (
    'ACTIVE',
    'VOTED',
    'DECEASED',
    'SUSPENDED'
);


--
-- Name: voter_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.voter_type_enum AS ENUM (
    'NORMAL',
    'POSTAL'
);


--
-- Name: watch_level_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.watch_level_enum AS ENUM (
    'READ_ONLY',
    'LIMITED'
);


--
-- Name: distribute_unassigned_voters(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.distribute_unassigned_voters(p_center_id integer, p_election_id integer) RETURNS TABLE(out_booth_number character varying, out_voters_assigned integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total_unassigned INTEGER;
    v_total_booths INTEGER;
BEGIN
    -- Count unassigned voters
    SELECT COUNT(*) INTO v_total_unassigned
    FROM voter_of_election
    WHERE center_id = p_center_id 
      AND election_id = p_election_id
      AND booth_id IS NULL;

    IF v_total_unassigned = 0 THEN
        RAISE NOTICE 'No unassigned voters found';
        RETURN;
    END IF;

    -- Count booths
    SELECT COUNT(*) INTO v_total_booths
    FROM polling_booth
    WHERE polling_center_id = p_center_id 
		AND election_id = p_election_id;

    IF v_total_booths = 0 THEN
        RAISE EXCEPTION 'No booths found for center %', p_center_id;
    END IF;

    -- Assign voters and return per-booth counts
    RETURN QUERY
    WITH voters AS (
        SELECT id,
               ROW_NUMBER() OVER (ORDER BY id) AS rn
        FROM voter_of_election
        WHERE center_id = p_center_id
          AND election_id = p_election_id
          AND booth_id IS NULL
    ),
    booths AS (
        SELECT id,
               booth_number,
               ROW_NUMBER() OVER (ORDER BY id) AS rn
        FROM polling_booth
        WHERE polling_center_id = p_center_id AND election_id = p_election_id
    ),
    booth_count AS (
        SELECT COUNT(*) AS total FROM booths
    ),
    assignment AS (
        SELECT v.id AS voter_id,
               b.id AS booth_id
        FROM voters v
        CROSS JOIN booth_count bc
        JOIN booths b
          ON ((v.rn - 1) % bc.total) + 1 = b.rn
    ),
    updated AS (
        UPDATE voter_of_election ve
        SET booth_id = a.booth_id
        FROM assignment a
        WHERE ve.id = a.voter_id
        RETURNING a.booth_id
    )
    SELECT 
        pb.booth_number,
        COUNT(*)::INTEGER AS out_voters_assigned
    FROM updated u
    JOIN polling_booth pb ON pb.id = u.booth_id AND pb.election_id = p_election_id
    GROUP BY pb.booth_number
    ORDER BY pb.booth_number;

    -- Final notice
    SELECT COUNT(*) INTO v_total_unassigned
    FROM voter_of_election
    WHERE center_id = p_center_id 
      AND election_id = p_election_id
      AND booth_id IS NULL;

    RAISE NOTICE 'Distribution complete. % voters remain unassigned.', v_total_unassigned;

END;
$$;


--
-- Name: distribute_unassigned_voters_p(integer, integer); Type: PROCEDURE; Schema: public; Owner: -
--

CREATE PROCEDURE public.distribute_unassigned_voters_p(IN p_center_id integer, IN p_election_id integer, OUT out_assigned_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total_unassigned INTEGER;
    v_total_booths INTEGER;
BEGIN
    -- Count unassigned voters
    SELECT COUNT(*) INTO v_total_unassigned
    FROM voter_of_election
    WHERE center_id = p_center_id 
      AND election_id = p_election_id
      AND booth_id IS NULL;

    IF v_total_unassigned = 0 THEN
        out_assigned_count := 0;
        RETURN;
    END IF;

    -- Count booths
    SELECT COUNT(*) INTO v_total_booths
    FROM polling_booth
    WHERE polling_center_id = p_center_id 
      AND election_id = p_election_id;

    IF v_total_booths = 0 THEN
        RAISE EXCEPTION 'No booths found for center %', p_center_id;
    END IF;

    -- Assign voters
    WITH voters AS (
        SELECT id,
               ROW_NUMBER() OVER (ORDER BY id) AS rn
        FROM voter_of_election
        WHERE center_id = p_center_id
          AND election_id = p_election_id
          AND booth_id IS NULL
    ),
    booths AS (
        SELECT id,
               ROW_NUMBER() OVER (ORDER BY id) AS rn
        FROM polling_booth
        WHERE polling_center_id = p_center_id 
          AND election_id = p_election_id
    ),
    booth_count AS (
        SELECT COUNT(*) AS total FROM booths
    ),
    assignment AS (
        SELECT v.id AS voter_id,
               b.id AS booth_id
        FROM voters v
        CROSS JOIN booth_count bc
        JOIN booths b
          ON ((v.rn - 1) % bc.total) + 1 = b.rn
    ),
    updated AS (
        UPDATE voter_of_election ve
        SET booth_id = a.booth_id
        FROM assignment a
        WHERE ve.id = a.voter_id
        RETURNING ve.id
    )
    SELECT COUNT(*) INTO out_assigned_count FROM updated;

END;
$$;


--
-- Name: generate_voter_otp(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_voter_otp(p_voter_of_election_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_election_id INTEGER;
    v_status TEXT;
    v_existing_used BOOLEAN;
    v_otp INTEGER;
BEGIN
    -- Get election_id
    SELECT election_id INTO v_election_id
    FROM voter_of_election
    WHERE id = p_voter_of_election_id;

    IF v_election_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Check election status
    SELECT status INTO v_status
    FROM election
    WHERE election_id = v_election_id;

    IF v_status <> 'LIVE' THEN
        RETURN NULL;
    END IF;

    -- Check if any OTP already used
    SELECT EXISTS (
        SELECT 1
        FROM voter_otp
        WHERE voter_of_election_id = p_voter_of_election_id
          AND is_used = TRUE
    ) INTO v_existing_used;

    IF v_existing_used THEN
        RETURN NULL;
    END IF;

    -- Generate 6-digit OTP
    v_otp := FLOOR(100000 + RANDOM() * 900000)::INTEGER;

    -- Insert OTP
    INSERT INTO voter_otp (
        voter_of_election_id,
        issued_at,
        expires_at,
        otp_value,
        is_used,
        attempt_count
    )
    VALUES (
        p_voter_of_election_id,
        NOW(),
        NOW() + INTERVAL '5 minutes',
        v_otp,
        FALSE,
        0
    );

    RETURN v_otp;
END;
$$;


--
-- Name: generate_voter_token(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_voter_token(p_voter_of_election_id integer) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_election_id INTEGER;
    v_center_id INTEGER;
    v_booth_id INTEGER;
    v_nid TEXT;
    v_raw TEXT;
    v_token TEXT;
BEGIN
    -- Fetch required fields
    SELECT election_id, center_id, booth_id, nid
    INTO v_election_id, v_center_id, v_booth_id, v_nid
    FROM voter_of_election
    WHERE id = p_voter_of_election_id;

    IF v_election_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Build raw string (with salt)
    v_raw := 
        v_election_id || '-' ||
        v_center_id || '-' ||
        v_booth_id || '-' ||
        p_voter_of_election_id || '-' ||
        v_nid || '-SALT123';

    -- Generate SHA-256 hash and truncate to 8 characters
    v_token := substring(
        encode(digest(v_raw, 'sha256'), 'hex')
        FROM 1 FOR 8
    );

    RETURN v_token;
END;
$$;


--
-- Name: get_closest_unallocated_voters(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_closest_unallocated_voters(p_center_id integer, p_election_id integer, p_limit integer) RETURNS TABLE(nid text, name text, phone text, distance double precision, lat numeric, lng numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_center_lat DECIMAL(10, 8);
    v_center_lng DECIMAL(11, 8);
    v_constituency_id INTEGER;
BEGIN
    -- Get center info
    SELECT pc.lat, pc.lng, pc.constituency_id
    INTO v_center_lat, v_center_lng, v_constituency_id
    FROM polling_center pc
    WHERE pc.id = p_center_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Polling center not found';
    END IF;

    RETURN QUERY
    SELECT 
        v.nid::TEXT,
        v.name::TEXT,
        v.phone::TEXT,
        (
            6371000 * 2 * ASIN(
                SQRT(
                    POWER(SIN(RADIANS((v.lat - v_center_lat) / 2)), 2) +
                    COS(RADIANS(v_center_lat)) * COS(RADIANS(v.lat)) *
                    POWER(SIN(RADIANS((v.lng - v_center_lng) / 2)), 2)
                )
            )
        )::FLOAT AS distance,
        v.lat,
        v.lng
    FROM voter_of_election voe
    JOIN voter v ON v.nid = voe.nid
    WHERE 
        voe.election_id = p_election_id
        AND voe.center_id IS NULL
        AND v.constituency_id = v_constituency_id
        AND v.lat IS NOT NULL
        AND v.lng IS NOT NULL
    ORDER BY distance
    LIMIT p_limit;

END;
$$;


--
-- Name: get_closest_voters(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_closest_voters(p_center_id integer, p_limit integer DEFAULT 100) RETURNS TABLE(nid character varying, name character varying, phone character varying, distance_meters double precision, lat numeric, lng numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_constituency_id INTEGER;
    v_center_lat DECIMAL(10, 8);
    v_center_lng DECIMAL(11, 8);
BEGIN
    -- Get the polling center's constituency and coordinates
    SELECT 
        pc.constituency_id, 
        pc.lat, 
        pc.lng 
    INTO 
        v_constituency_id, 
        v_center_lat, 
        v_center_lng
    FROM polling_center pc
    WHERE pc.id = p_center_id;
    
    -- Return closest voters from that constituency
    RETURN QUERY
    SELECT 
        v.nid,
        v.name,
        v.phone,
        -- Calculate distance using Haversine formula (in meters)
        6371000 * 2 * ASIN(
            SQRT(
                POWER(SIN(RADIANS((v.lat - v_center_lat) / 2)), 2) +
                COS(RADIANS(v_center_lat)) * COS(RADIANS(v.lat)) *
                POWER(SIN(RADIANS((v.lng - v_center_lng) / 2)), 2)
            )
        ) AS distance_meters,
        v.lat,
        v.lng
    FROM voter v
    WHERE v.constituency_id = v_constituency_id
    ORDER BY distance_meters
    LIMIT p_limit;
END;
$$;


--
-- Name: get_party_seats(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_party_seats(p_election_id integer) RETURNS TABLE(party_name text, seat_count integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH vote_counts AS (
        SELECT 
            vl.constituency_of_election_id,
            c.candidate_id,
            UPPER(c.party) AS party,
            COUNT(*) AS votes
        FROM voting_log vl
        JOIN candidate c ON c.candidate_id = vl.candidate_id
        WHERE vl.constituency_of_election_id IN (
            SELECT id
            FROM constituency_of_election
            WHERE election_id = p_election_id
        )
        GROUP BY vl.constituency_of_election_id, c.candidate_id, UPPER(c.party)
    ),
    ranked AS (
        SELECT *,
               ROW_NUMBER() OVER (
                   PARTITION BY constituency_of_election_id
                   ORDER BY votes DESC
               ) AS rn
        FROM vote_counts
    ),
    winners AS (
        SELECT party
        FROM ranked
        WHERE rn = 1
    )
    SELECT 
        party AS party_name,
        COUNT(*)::INTEGER AS seat_count
    FROM winners
    GROUP BY party
    ORDER BY seat_count DESC;

END;
$$;


--
-- Name: handle_polling_booth_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_polling_booth_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 1. Clear voters assigned to this booth
    UPDATE voter_of_election
    SET booth_id = NULL
    WHERE booth_id = OLD.id;

    -- 2. Delete PO role mappings associated with this booth
    DELETE FROM role_map
    WHERE role = 'PO'
      AND relation_id = OLD.id;

    RETURN OLD;
END;
$$;


--
-- Name: handle_polling_center_election_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_polling_center_election_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Delete voters assigned to this polling center for this election
    DELETE FROM voter_of_election
    WHERE center_id = OLD.polling_center_id
      AND election_id = OLD.election_id;

    -- Delete Presiding Officers for this center-election
    DELETE FROM role_map
    WHERE role = 'PRO'
      AND relation_id = OLD.polling_center_id
      AND election_id = OLD.election_id;

    RETURN OLD;
END;
$$;


--
-- Name: verify_voter_otp(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_voter_otp(p_booth_id integer, p_otp text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_otp_id INTEGER;
    v_voter_id INTEGER;
    v_expires_at TIMESTAMP;
    v_voter_booth INTEGER;
BEGIN
    -- Get latest matching unused OTP
    SELECT otp_id, voter_of_election_id, expires_at
    INTO v_otp_id, v_voter_id, v_expires_at
    FROM voter_otp
    WHERE otp_value = p_otp
      AND is_used = FALSE
    ORDER BY issued_at DESC
    LIMIT 1;

    -- No OTP found
    IF v_otp_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check expiry
    IF NOW() > v_expires_at THEN
        RETURN FALSE;
    END IF;

    -- Get voter's booth
    SELECT booth_id INTO v_voter_booth
    FROM voter_of_election
    WHERE id = v_voter_id;

    -- Booth match
    IF v_voter_booth = p_booth_id THEN
        -- Mark OTP as used
        UPDATE voter_otp
        SET is_used = TRUE
        WHERE otp_id = v_otp_id;

        RETURN TRUE;
    ELSE
        -- Wrong booth → increment attempt_count
        UPDATE voter_otp
        SET attempt_count = attempt_count + 1
        WHERE otp_id = v_otp_id;

        RETURN FALSE;
    END IF;

END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    log_id integer NOT NULL,
    action_type public.audit_action_enum NOT NULL,
    user_id text NOT NULL,
    target_entity_id text,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    details character varying(1000),
    table_name character varying(50)
);


--
-- Name: audit_log_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_log_id_seq OWNED BY public.audit_log.log_id;


--
-- Name: ballot_unit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ballot_unit (
    unit_id integer NOT NULL,
    booth_id integer NOT NULL,
    firmware_version character varying(50) NOT NULL,
    is_tampered boolean DEFAULT false NOT NULL,
    status public.ballot_unit_status_enum DEFAULT 'ACTIVE'::public.ballot_unit_status_enum NOT NULL,
    CONSTRAINT chk_firmware_nonempty CHECK ((TRIM(BOTH FROM firmware_version) <> ''::text))
);


--
-- Name: ballot_unit_unit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ballot_unit_unit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ballot_unit_unit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ballot_unit_unit_id_seq OWNED BY public.ballot_unit.unit_id;


--
-- Name: booth_watcher; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booth_watcher (
    watcher_id integer NOT NULL,
    user_id integer NOT NULL,
    booth_id integer NOT NULL,
    watch_level public.watch_level_enum NOT NULL
);


--
-- Name: booth_watcher_watcher_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.booth_watcher_watcher_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: booth_watcher_watcher_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.booth_watcher_watcher_id_seq OWNED BY public.booth_watcher.watcher_id;


--
-- Name: candidate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate (
    candidate_id integer NOT NULL,
    name character varying(150) NOT NULL,
    party character varying(100) NOT NULL,
    nomination_status public.nomination_status_enum DEFAULT 'PENDING'::public.nomination_status_enum NOT NULL,
    nota_flag boolean DEFAULT false NOT NULL,
    constituency_of_election_id integer,
    CONSTRAINT chk_candidate_name_nonempty CHECK ((TRIM(BOTH FROM name) <> ''::text)),
    CONSTRAINT chk_party_nonempty CHECK ((TRIM(BOTH FROM party) <> ''::text))
);


--
-- Name: candidate_candidate_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.candidate_candidate_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: candidate_candidate_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.candidate_candidate_id_seq OWNED BY public.candidate.candidate_id;


--
-- Name: constituency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.constituency (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    region character varying(100),
    lat numeric(10,8),
    lng numeric(11,8)
);


--
-- Name: constituency_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.constituency_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: constituency_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.constituency_id_seq OWNED BY public.constituency.id;


--
-- Name: constituency_of_election; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.constituency_of_election (
    id integer NOT NULL,
    election_id integer NOT NULL,
    constituency_id integer NOT NULL
);


--
-- Name: constituency_of_election_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.constituency_of_election_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: constituency_of_election_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.constituency_of_election_id_seq OWNED BY public.constituency_of_election.id;


--
-- Name: dispute_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispute_log (
    dispute_id integer NOT NULL,
    center_id integer NOT NULL,
    filed_by integer NOT NULL,
    description character varying(500) NOT NULL,
    status public.dispute_status_enum DEFAULT 'OPEN'::public.dispute_status_enum NOT NULL,
    filed_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved_at timestamp without time zone,
    CONSTRAINT chk_dispute_description CHECK ((length(TRIM(BOTH FROM description)) > 0)),
    CONSTRAINT dispute_log_check CHECK ((((status = 'RESOLVED'::public.dispute_status_enum) AND (resolved_at IS NOT NULL)) OR ((status = 'OPEN'::public.dispute_status_enum) AND (resolved_at IS NULL))))
);


--
-- Name: dispute_log_dispute_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dispute_log_dispute_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dispute_log_dispute_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dispute_log_dispute_id_seq OWNED BY public.dispute_log.dispute_id;


--
-- Name: election; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.election (
    election_id integer NOT NULL,
    name character varying(150) NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    status public.election_status_enum DEFAULT 'PLANNED'::public.election_status_enum NOT NULL,
    CONSTRAINT chk_election_dates CHECK ((end_date > start_date)),
    CONSTRAINT chk_election_name_nonempty CHECK ((TRIM(BOTH FROM name) <> ''::text))
);


--
-- Name: election_election_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.election_election_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: election_election_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.election_election_id_seq OWNED BY public.election.election_id;


--
-- Name: election_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.election_schedule (
    schedule_id integer NOT NULL,
    constituency_id integer NOT NULL,
    phase_number integer NOT NULL,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    status public.schedule_status_enum DEFAULT 'PLANNED'::public.schedule_status_enum NOT NULL,
    CONSTRAINT chk_schedule_time CHECK ((end_time > start_time)),
    CONSTRAINT election_schedule_phase_number_check CHECK ((phase_number > 0))
);


--
-- Name: election_schedule_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.election_schedule_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: election_schedule_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.election_schedule_schedule_id_seq OWNED BY public.election_schedule.schedule_id;


--
-- Name: login_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_log (
    login_id integer NOT NULL,
    user_id text NOT NULL,
    role public.user_role_enum NOT NULL,
    login_time timestamp without time zone DEFAULT now() NOT NULL,
    logout_time timestamp without time zone,
    ip_address character varying(45),
    success_flag boolean DEFAULT true NOT NULL
);


--
-- Name: login_log_login_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.login_log_login_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: login_log_login_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.login_log_login_id_seq OWNED BY public.login_log.login_id;


--
-- Name: override_approval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.override_approval (
    approval_id integer NOT NULL,
    request_id integer NOT NULL,
    user_id integer NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: override_approval_approval_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.override_approval_approval_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: override_approval_approval_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.override_approval_approval_id_seq OWNED BY public.override_approval.approval_id;


--
-- Name: poll_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poll_session (
    session_id integer NOT NULL,
    election_id integer NOT NULL,
    center_id integer NOT NULL,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    ended_at timestamp without time zone,
    status public.poll_session_status_enum DEFAULT 'OPEN'::public.poll_session_status_enum NOT NULL,
    CONSTRAINT chk_session_time CHECK (((ended_at IS NULL) OR (ended_at > started_at)))
);


--
-- Name: poll_session_session_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.poll_session_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: poll_session_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.poll_session_session_id_seq OWNED BY public.poll_session.session_id;


--
-- Name: polling_booth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.polling_booth (
    id integer NOT NULL,
    booth_number character varying(50),
    polling_center_id integer,
    election_id integer
);


--
-- Name: polling_booth_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.polling_booth_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: polling_booth_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.polling_booth_id_seq OWNED BY public.polling_booth.id;


--
-- Name: polling_center; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.polling_center (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    address text,
    constituency_id integer,
    lat numeric(10,8),
    lng numeric(11,8)
);


--
-- Name: polling_center_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.polling_center_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: polling_center_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.polling_center_id_seq OWNED BY public.polling_center.id;


--
-- Name: polling_center_of_election; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.polling_center_of_election (
    id integer NOT NULL,
    polling_center_id integer NOT NULL,
    election_id integer NOT NULL
);


--
-- Name: polling_center_of_election_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.polling_center_of_election_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: polling_center_of_election_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.polling_center_of_election_id_seq OWNED BY public.polling_center_of_election.id;


--
-- Name: role_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_map (
    id integer NOT NULL,
    election_id integer NOT NULL,
    role public.user_role_enum NOT NULL,
    relation_id integer,
    user_id integer NOT NULL
);


--
-- Name: role_map_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_map_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_map_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_map_id_seq OWNED BY public.role_map.id;


--
-- Name: sensitive_operations_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sensitive_operations_request (
    request_id integer NOT NULL,
    type character varying(100) NOT NULL,
    target_entity_id integer NOT NULL,
    approval_count integer DEFAULT 0 NOT NULL,
    required_approvals integer NOT NULL,
    status public.sensitive_request_status_enum DEFAULT 'PENDING'::public.sensitive_request_status_enum NOT NULL,
    requested_by integer NOT NULL,
    requested_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_approval_count_limit CHECK ((approval_count <= required_approvals)),
    CONSTRAINT chk_approval_count_nonnegative CHECK ((approval_count >= 0)),
    CONSTRAINT sensitive_operations_request_required_approvals_check CHECK ((required_approvals > 0))
);


--
-- Name: sensitive_operations_request_request_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sensitive_operations_request_request_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sensitive_operations_request_request_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sensitive_operations_request_request_id_seq OWNED BY public.sensitive_operations_request.request_id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'USER'::text NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['ADMIN'::text, 'USER'::text])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vote_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vote_log (
    vote_id integer NOT NULL,
    unit_id integer NOT NULL,
    candidate_id integer NOT NULL,
    batch_id integer NOT NULL,
    encrypted_choice character varying(500) NOT NULL,
    seq_number integer NOT NULL,
    CONSTRAINT chk_seq_positive CHECK ((seq_number > 0))
);


--
-- Name: vote_log_vote_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vote_log_vote_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vote_log_vote_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vote_log_vote_id_seq OWNED BY public.vote_log.vote_id;


--
-- Name: voter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voter (
    nid character varying(20) NOT NULL,
    name character varying(150) NOT NULL,
    phone character varying(20),
    email character varying(150),
    voter_type public.voter_type_enum,
    fingerprint_hash character varying(255),
    constituency_id integer,
    lat numeric(10,8),
    lng numeric(11,8)
);


--
-- Name: voter_of_election; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voter_of_election (
    id integer NOT NULL,
    nid character varying(20) NOT NULL,
    election_id integer NOT NULL,
    center_id integer,
    last_voted_at timestamp without time zone,
    last_otp_sent_at timestamp without time zone,
    assigned_by text,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    booth_id integer
);


--
-- Name: voter_of_election_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voter_of_election_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voter_of_election_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voter_of_election_id_seq OWNED BY public.voter_of_election.id;


--
-- Name: voter_otp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voter_otp (
    otp_id integer NOT NULL,
    voter_of_election_id integer CONSTRAINT voter_otp_voter_id_not_null NOT NULL,
    issued_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    otp_value character varying(10) CONSTRAINT voter_otp_token_not_null NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT chk_otp_attempts CHECK (((attempt_count >= 0) AND (attempt_count <= 5))),
    CONSTRAINT chk_otp_expiry CHECK ((expires_at > issued_at)),
    CONSTRAINT chk_token_nonempty CHECK ((TRIM(BOTH FROM otp_value) <> ''::text))
);


--
-- Name: voter_otp_otp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voter_otp_otp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voter_otp_otp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voter_otp_otp_id_seq OWNED BY public.voter_otp.otp_id;


--
-- Name: voter_participation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voter_participation (
    participation_id integer NOT NULL,
    voter_id integer NOT NULL,
    session_id integer NOT NULL,
    token_id integer NOT NULL,
    otp_id integer NOT NULL,
    has_voted boolean DEFAULT false NOT NULL,
    verified_at timestamp without time zone,
    CONSTRAINT chk_vote_after_verification CHECK (((has_voted = false) OR (verified_at IS NOT NULL)))
);


--
-- Name: voter_participation_participation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voter_participation_participation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voter_participation_participation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voter_participation_participation_id_seq OWNED BY public.voter_participation.participation_id;


--
-- Name: voting_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voting_log (
    id bigint NOT NULL,
    voter_token character varying(100) NOT NULL,
    constituency_of_election_id integer NOT NULL,
    candidate_id integer NOT NULL,
    vote_time timestamp without time zone DEFAULT now()
);


--
-- Name: voting_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voting_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voting_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voting_log_id_seq OWNED BY public.voting_log.id;


--
-- Name: voting_token; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voting_token (
    token_id integer NOT NULL,
    voter_id integer NOT NULL,
    booth_id integer NOT NULL,
    issued_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    batch_id integer NOT NULL,
    CONSTRAINT chk_token_valid CHECK ((expires_at > issued_at))
);


--
-- Name: voting_token_token_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voting_token_token_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voting_token_token_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voting_token_token_id_seq OWNED BY public.voting_token.token_id;


--
-- Name: audit_log log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN log_id SET DEFAULT nextval('public.audit_log_log_id_seq'::regclass);


--
-- Name: ballot_unit unit_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ballot_unit ALTER COLUMN unit_id SET DEFAULT nextval('public.ballot_unit_unit_id_seq'::regclass);


--
-- Name: booth_watcher watcher_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booth_watcher ALTER COLUMN watcher_id SET DEFAULT nextval('public.booth_watcher_watcher_id_seq'::regclass);


--
-- Name: candidate candidate_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate ALTER COLUMN candidate_id SET DEFAULT nextval('public.candidate_candidate_id_seq'::regclass);


--
-- Name: constituency id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constituency ALTER COLUMN id SET DEFAULT nextval('public.constituency_id_seq'::regclass);


--
-- Name: constituency_of_election id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constituency_of_election ALTER COLUMN id SET DEFAULT nextval('public.constituency_of_election_id_seq'::regclass);


--
-- Name: dispute_log dispute_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute_log ALTER COLUMN dispute_id SET DEFAULT nextval('public.dispute_log_dispute_id_seq'::regclass);


--
-- Name: election election_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.election ALTER COLUMN election_id SET DEFAULT nextval('public.election_election_id_seq'::regclass);


--
-- Name: election_schedule schedule_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.election_schedule ALTER COLUMN schedule_id SET DEFAULT nextval('public.election_schedule_schedule_id_seq'::regclass);


--
-- Name: login_log login_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_log ALTER COLUMN login_id SET DEFAULT nextval('public.login_log_login_id_seq'::regclass);


--
-- Name: override_approval approval_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.override_approval ALTER COLUMN approval_id SET DEFAULT nextval('public.override_approval_approval_id_seq'::regclass);


--
-- Name: poll_session session_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_session ALTER COLUMN session_id SET DEFAULT nextval('public.poll_session_session_id_seq'::regclass);


--
-- Name: polling_booth id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polling_booth ALTER COLUMN id SET DEFAULT nextval('public.polling_booth_id_seq'::regclass);


--
-- Name: polling_center id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polling_center ALTER COLUMN id SET DEFAULT nextval('public.polling_center_id_seq'::regclass);


--
-- Name: polling_center_of_election id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polling_center_of_election ALTER COLUMN id SET DEFAULT nextval('public.polling_center_of_election_id_seq'::regclass);


--
-- Name: role_map id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_map ALTER COLUMN id SET DEFAULT nextval('public.role_map_id_seq'::regclass);


--
-- Name: sensitive_operations_request request_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensitive_operations_request ALTER COLUMN request_id SET DEFAULT nextval('public.sensitive_operations_request_request_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vote_log vote_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote_log ALTER COLUMN vote_id SET DEFAULT nextval('public.vote_log_vote_id_seq'::regclass);


--
-- Name: voter_of_election id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_of_election ALTER COLUMN id SET DEFAULT nextval('public.voter_of_election_id_seq'::regclass);


--
-- Name: voter_otp otp_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_otp ALTER COLUMN otp_id SET DEFAULT nextval('public.voter_otp_otp_id_seq'::regclass);


--
-- Name: voter_participation participation_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_participation ALTER COLUMN participation_id SET DEFAULT nextval('public.voter_participation_participation_id_seq'::regclass);


--
-- Name: voting_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voting_log ALTER COLUMN id SET DEFAULT nextval('public.voting_log_id_seq'::regclass);


--
-- Name: voting_token token_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voting_token ALTER COLUMN token_id SET DEFAULT nextval('public.voting_token_token_id_seq'::regclass);


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_log (log_id, action_type, user_id, target_entity_id, "timestamp", details, table_name) FROM stdin;
1	APPROVE	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	SLLYf8Bthnu67IzrlJEPvcVTN47mjRFu	2026-04-02 06:06:06.683181	{"email":"aa3@aa.com"}	user
2	DELETE	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	wY7yBSiLBzq92spIQzBPVHCIPOxnAhSG	2026-04-02 06:11:00.950751	{"email":"aa3@aa.com"}	user
4	APPROVE	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	Lgkad2GuiokLYYjydmef5FsKncQHfvSz	2026-04-02 07:40:39.312592	{"email":"aa3@aa.com"}	user
9	APPROVE	1	12	2026-04-03 19:11:20.049464	{"email":"calciumdeficiency@gmail.com"}	user
10	APPROVE	1	11	2026-04-03 19:11:21.001343	{"email":"mandycandy@gmail.com"}	user
11	APPROVE	1	10	2026-04-03 19:11:21.981693	{"email":"aristotle@gmail.com"}	user
12	APPROVE	1	9	2026-04-03 19:11:22.846119	{"email":"kinginyellow@gmail.com"}	user
13	APPROVE	1	8	2026-04-03 19:11:23.5719	{"email":"kikiholmes@gmail.com"}	user
14	APPROVE	1	7	2026-04-03 19:11:26.339218	{"email":"donaldtrump@gmail.com"}	user
15	APPROVE	1	6	2026-04-03 19:11:27.458625	{"email":"captaincelebrity@gmail.com"}	user
16	APPROVE	1	5	2026-04-03 19:11:28.280041	{"email":"joesephjoestar@gmail.com"}	user
17	CREATE	9	30	2026-04-03 22:12:27.820301	"Added candidate: Humming Florist"	candidate
18	CREATE	9	31	2026-04-03 22:12:57.798133	"Added candidate: Piglin Brute #348"	candidate
19	DELETE	1	7	2026-04-03 23:03:47.605588	{"name":"Arekta"}	election
20	DELETE	1	8	2026-04-03 23:03:57.583872	{"name":"ee"}	election
21	DELETE	1	10	2026-04-03 23:04:02.620284	{"name":"Demo"}	election
22	CREATE	1	24	2026-04-04 00:33:41.488429	{"name":"Election 1999","status":"PLANNED"}	election
23	CREATE	2	32	2026-04-04 02:40:36.524899	"Added candidate: mahdiat"	candidate
24	CREATE	2	33	2026-04-04 02:40:44.208689	"Added candidate: arib"	candidate
25	CREATE	2	34	2026-04-04 02:40:56.096545	"Added candidate: sadman"	candidate
26	CREATE	1	25	2026-04-04 06:06:13.220675	{"name":"Election 2001","status":"PLANNED"}	election
27	CREATE	10	35	2026-04-04 06:10:50.737485	"Added candidate: Fyodor Dostoevsky"	candidate
28	CREATE	10	36	2026-04-04 06:11:46.77791	"Added candidate: Franz Kafka"	candidate
29	CREATE	10	37	2026-04-04 06:12:10.893844	"Added candidate: Humayun Ahmed"	candidate
30	CREATE	10	38	2026-04-04 06:12:46.914385	"Added candidate: Rabindranath"	candidate
31	CREATE	10	39	2026-04-04 06:14:46.984397	"Added candidate: Mark Twain"	candidate
32	DELETE	10	39	2026-04-04 06:14:56.735141	"Removed candidate ID: 39"	candidate
33	CREATE	10	40	2026-04-04 06:15:23.553852	"Added candidate: Mark Twain"	candidate
34	CREATE	8	41	2026-04-04 06:17:22.729107	"Added candidate: Micheal Jackson"	candidate
35	CREATE	8	42	2026-04-04 06:18:04.580437	"Added candidate: Lana Del Rey"	candidate
36	CREATE	8	43	2026-04-04 06:18:14.541556	"Added candidate: Minar"	candidate
37	CREATE	8	44	2026-04-04 06:18:32.369962	"Added candidate: Topu"	candidate
38	CREATE	8	45	2026-04-04 06:18:50.081562	"Added candidate: Ed Sheeran"	candidate
39	APPROVE	1	14	2026-04-04 07:07:30.56173	{"email":"sadman@gmail.com"}	user
40	APPROVE	1	13	2026-04-04 07:07:32.387676	{"email":"tj@gmail.com"}	user
41	APPROVE	1	22	2026-04-04 07:13:57.331678	{"email":"fatin@gmail.com"}	user
42	APPROVE	1	23	2026-04-04 07:13:59.375756	{"email":"tajrian@gmail.com"}	user
43	APPROVE	1	21	2026-04-04 07:14:00.623932	{"email":"ashfaq@gmail.com"}	user
44	APPROVE	1	20	2026-04-04 07:14:01.424202	{"email":"safwan@gmail.com"}	user
45	APPROVE	1	19	2026-04-04 07:14:02.164807	{"email":"jamee@gmail.com"}	user
46	APPROVE	1	18	2026-04-04 07:14:03.475724	{"email":"rajin@gmail.com"}	user
47	DELETE	1	17	2026-04-04 07:14:07.575849	{"email":"fahim@gmail.com"}	user
48	APPROVE	1	16	2026-04-04 07:14:14.844082	{"email":"aritro@gmail.com"}	user
49	APPROVE	1	15	2026-04-04 07:14:16.395911	{"email":"alu@gmail.com"}	user
50	APPROVE	1	24	2026-04-04 07:14:50.205872	{"email":"Fahim@gmail.com"}	user
51	CREATE	13	46	2026-04-04 07:20:28.707955	"Added candidate: Picasso"	candidate
52	CREATE	13	47	2026-04-04 07:20:53.628097	"Added candidate: Joynul Abedin"	candidate
53	CREATE	13	48	2026-04-04 07:21:20.640125	"Added candidate: Leonardo Da Vinci"	candidate
54	CREATE	16	49	2026-04-04 07:33:37.497296	"Added candidate: John Wick"	candidate
55	CREATE	16	50	2026-04-04 07:34:04.162907	"Added candidate: Tony Stark"	candidate
56	CREATE	16	51	2026-04-04 07:34:22.7676	"Added candidate: Pepper Pops"	candidate
57	CREATE	21	52	2026-04-04 07:41:56.20723	"Added candidate: Tanjiro Kamado"	candidate
58	CREATE	21	53	2026-04-04 07:42:19.236693	"Added candidate: Yuzi Itadori"	candidate
59	CREATE	21	54	2026-04-04 07:42:39.225535	"Added candidate: Izuku Midoriya"	candidate
60	CREATE	1	26	2026-04-04 09:37:55.750948	{"name":"Election 2004","status":"LIVE"}	election
61	APPROVE	1	28	2026-04-04 09:39:21.617046	{"email":"john@gmail.com"}	user
62	CREATE	10	55	2026-04-04 09:47:46.306232	"Added candidate: Chicken"	candidate
63	CREATE	10	56	2026-04-04 09:48:06.504357	"Added candidate: Derek"	candidate
64	CREATE	10	57	2026-04-04 10:49:12.090523	"Added candidate: Saddam Hussein"	candidate
\.


--
-- Data for Name: ballot_unit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ballot_unit (unit_id, booth_id, firmware_version, is_tampered, status) FROM stdin;
\.


--
-- Data for Name: booth_watcher; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.booth_watcher (watcher_id, user_id, booth_id, watch_level) FROM stdin;
\.


--
-- Data for Name: candidate; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.candidate (candidate_id, name, party, nomination_status, nota_flag, constituency_of_election_id) FROM stdin;
2	Trevor Wallace	Im funny	REJECTED	f	\N
3	arib	leftist	APPROVED	f	\N
5	Cream Khan	Meatballs	APPROVED	f	1
4	Digory Alam	New Order	APPROVED	f	1
8	Dandy tough	Candyrush	APPROVED	f	7
7	Mandy Candy	Sweet&Sour	APPROVED	f	7
6	Mango Tango	Nutrilife	REJECTED	f	7
9	Rain Quil	Birds United	APPROVED	f	1
10	Mahdiat	Khorgosh	APPROVED	f	13
12	Miss Midnight	BIRDS UNITED	APPROVED	f	2
14	Popstep Crush	Independent	APPROVED	f	2
13	Rock Stampede	New Order	APPROVED	f	2
17	La Brava	Coffee Brewers	APPROVED	f	29
16	Mr. Hawks	Birds United	APPROVED	f	29
15	Red Riot	New Order	APPROVED	f	29
30	Humming Florist	Lily	APPROVED	f	42
31	Piglin Brute #348	Piglin	APPROVED	f	42
22	liya	aa	REJECTED	f	\N
23	hihi	hihi	APPROVED	f	\N
24	jj	jj	APPROVED	f	\N
25	jhfhigf	mhvkjg	PENDING	f	\N
27	asdf	adsfasdfadsf	PENDING	f	\N
28	adf	asdfasdf	PENDING	f	\N
29	asdf	whyis it woking	PENDING	f	\N
18	dfwedfef	wefwef	PENDING	f	\N
33	arib	arib	APPROVED	f	50
32	mahdiat	mahdiat	APPROVED	f	50
34	sadman	sadman	APPROVED	f	50
36	Franz Kafka	Golden Wind	APPROVED	f	51
35	Fyodor Dostoevsky	Coffee Brewers	APPROVED	f	51
37	Humayun Ahmed	Independent	APPROVED	f	51
40	Mark Twain	Big Stack	APPROVED	f	51
38	Rabindranath	Independent	APPROVED	f	51
45	Ed Sheeran	Nice Shape	APPROVED	f	52
41	Micheal Jackson	Golden Wind	APPROVED	f	52
43	Minar	Independent	APPROVED	f	52
44	Topu	Independent	APPROVED	f	52
47	Joynul Abedin	Independent	APPROVED	f	53
48	Leonardo Da Vinci	Golden Wind	APPROVED	f	53
46	Picasso	Coffee Brewers	APPROVED	f	53
42	Lana Del Rey	Coffee Brewers	APPROVED	f	52
49	John Wick	Coffee Brewers	APPROVED	f	54
51	Pepper Pops	Independent	APPROVED	f	54
50	Tony Stark	Golden Wind	APPROVED	f	54
54	Izuku Midoriya	Golden Wind	APPROVED	f	55
52	Tanjiro Kamado	Independent	APPROVED	f	55
53	Yuzi Itadori	Coffee Brewers	APPROVED	f	55
56	Derek	BFC	APPROVED	f	56
55	Chicken	KFC	APPROVED	f	56
57	Saddam Hussein	Arab Socialist Baath Party	PENDING	f	51
\.


--
-- Data for Name: constituency; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.constituency (id, name, region, lat, lng) FROM stdin;
1	Dhaka-1	Dhaka	23.87590000	90.37950000
2	Dhaka-6	Dhaka	23.78000000	90.38000000
3	Gazipur-1	Dhaka	23.99990000	90.42030000
4	Chittagong-8	Chittagong	22.35690000	91.78320000
5	Chittagong-11	Chittagong	22.33500000	91.83250000
6	Rajshahi-3	Rajshahi	24.37450000	88.60420000
7	Bogura-4	Rajshahi	24.85100000	89.37200000
8	Khulna-2	Khulna	22.81560000	89.55690000
9	Jessore-5	Khulna	23.16850000	89.20360000
10	Sylhet-2	Sylhet	24.89490000	91.86870000
12	dhk99	sv	23.69452300	90.38274700
13	Dmd lake	Dhanmondi Lake	23.75220200	90.37168500
\.


--
-- Data for Name: constituency_of_election; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.constituency_of_election (id, election_id, constituency_id) FROM stdin;
1	2	1
2	2	2
7	1	4
10	4	4
11	4	1
12	4	2
13	4	7
14	4	3
15	4	9
16	4	5
17	4	8
18	4	6
19	4	10
25	1	3
26	1	8
27	1	9
29	2	4
41	23	10
42	23	6
47	24	1
48	24	2
49	24	4
50	24	5
51	25	1
52	25	2
53	25	4
54	25	5
55	25	9
56	26	1
57	26	2
58	26	9
\.


--
-- Data for Name: dispute_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dispute_log (dispute_id, center_id, filed_by, description, status, filed_at, resolved_at) FROM stdin;
\.


--
-- Data for Name: election; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.election (election_id, name, start_date, end_date, status) FROM stdin;
2	Election 1998	2026-03-15 08:22:00	2026-03-21 08:22:00	FINALIZED
1	Election 1997	2026-03-17 17:11:00	2026-03-23 17:11:00	FINALIZED
4	Amar sonar bangla election	2026-03-22 19:29:00	2026-03-26 19:29:00	FINALIZED
23	jwt hunt	2026-03-30 11:11:00	2026-04-06 11:11:00	PLANNED
24	Election 1999	2026-04-05 13:20:00	2026-04-15 18:30:00	PLANNED
26	Election 2004	2026-04-03 15:33:00	2026-04-09 11:11:00	FINALIZED
25	Election 2001	2026-04-04 09:00:00	2026-04-05 18:00:00	FINALIZED
\.


--
-- Data for Name: election_schedule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.election_schedule (schedule_id, constituency_id, phase_number, start_time, end_time, status) FROM stdin;
\.


--
-- Data for Name: login_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.login_log (login_id, user_id, role, login_time, logout_time, ip_address, success_flag) FROM stdin;
1	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 05:45:29.043321	\N	::1	t
3	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 05:48:33.597355	\N	::1	t
4	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 05:51:46.577707	\N	::1	t
5	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 05:58:37.186982	\N	::1	t
6	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 06:03:55.517885	\N	::1	t
7	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 06:05:16.400265	\N	::1	t
8	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 06:10:49.680341	\N	::1	t
9	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 06:28:21.111248	\N	::1	t
10	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 07:00:51.258477	\N	::1	t
11	ZgBrdAED8DCqhOnEbeciFU5B7LzA4KNv	USER	2026-04-02 07:08:54.190829	\N	::1	t
12	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 07:10:34.861032	\N	::1	t
13	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 07:22:37.382076	\N	::1	t
14	ZgBrdAED8DCqhOnEbeciFU5B7LzA4KNv	USER	2026-04-02 07:24:28.174278	\N	::1	t
15	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 07:30:08.496213	\N	::1	t
16	ZgBrdAED8DCqhOnEbeciFU5B7LzA4KNv	USER	2026-04-02 07:31:08.533534	\N	::1	t
17	ZgBrdAED8DCqhOnEbeciFU5B7LzA4KNv	USER	2026-04-02 07:33:08.818834	\N	::1	t
18	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 07:33:49.287609	\N	::1	t
19	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 07:37:36.306056	\N	::1	t
20	ZgBrdAED8DCqhOnEbeciFU5B7LzA4KNv	USER	2026-04-02 07:53:42.943635	\N	::1	t
21	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 07:57:47.260032	\N	::1	t
22	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 08:17:12.282629	\N	::1	t
23	ZgBrdAED8DCqhOnEbeciFU5B7LzA4KNv	USER	2026-04-02 08:17:34.065074	\N	::1	t
24	ZgBrdAED8DCqhOnEbeciFU5B7LzA4KNv	USER	2026-04-02 08:18:41.697867	\N	::1	t
25	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 08:19:01.532742	\N	::1	t
26	ZgBrdAED8DCqhOnEbeciFU5B7LzA4KNv	USER	2026-04-02 09:41:58.049364	\N	::1	t
27	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 09:51:08.944992	\N	::1	t
28	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 10:41:20.633988	\N	::1	t
29	ZgBrdAED8DCqhOnEbeciFU5B7LzA4KNv	USER	2026-04-02 10:42:07.229525	\N	::1	t
30	ZgBrdAED8DCqhOnEbeciFU5B7LzA4KNv	USER	2026-04-02 12:24:40.854182	\N	::1	t
31	ZgBrdAED8DCqhOnEbeciFU5B7LzA4KNv	USER	2026-04-02 12:26:28.201172	\N	::1	t
32	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 12:27:27.043999	\N	::1	t
33	ZgBrdAED8DCqhOnEbeciFU5B7LzA4KNv	USER	2026-04-02 12:35:27.360213	\N	::1	t
34	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	ADMIN	2026-04-02 12:48:34.397836	\N	::1	t
\.


--
-- Data for Name: override_approval; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.override_approval (approval_id, request_id, user_id, "timestamp") FROM stdin;
\.


--
-- Data for Name: poll_session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.poll_session (session_id, election_id, center_id, started_at, ended_at, status) FROM stdin;
\.


--
-- Data for Name: polling_booth; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.polling_booth (id, booth_number, polling_center_id, election_id) FROM stdin;
1	1	2	2
5	2	2	2
6	3	2	2
8	2	10	4
9	1	13	4
10	2	13	4
11	1	7	1
12	1	3	2
13	1	7	2
15	1	10	7
16	1	11	23
17	2	11	23
18	1	12	23
19	1	10	24
20	1	1	25
21	1	2	25
22	1	3	25
23	1	4	25
24	1	7	25
25	1	25	25
26	1	17	25
27	1	1	26
28	2	1	26
\.


--
-- Data for Name: polling_center; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.polling_center (id, name, address, constituency_id, lat, lng) FROM stdin;
1	Dhanmondi Government Boys High School	Road 2, Dhanmondi, Dhaka	1	23.74670000	90.37450000
2	Hazaribagh Women's College	Hazaribagh, Dhaka	1	23.73580000	90.36540000
3	Kakrail Government Primary School	Kakrail, Dhaka	2	23.73780000	90.41320000
4	Shahbagh Police Lines School	Shahbagh, Dhaka	2	23.73910000	90.39530000
5	Gazipur Cantonment Board School	Gazipur Cantonment, Gazipur	3	23.99870000	90.41890000
6	Kaliganj Government College	Kaliganj, Gazipur	3	24.01230000	90.42120000
7	Chittagong Collegiate School	Ice Factory Road, Chittagong	4	22.34890000	91.81450000
8	Government Muslim High School	Anderkilla, Chittagong	4	22.34560000	91.83120000
9	Patenga Government Primary School	Patenga, Chittagong	5	22.26890000	91.79870000
10	Halishahar Degree College	Halishahar, Chittagong	5	22.28910000	91.78120000
11	Rajshahi Collegiate School	Sona Danga, Rajshahi	6	24.37480000	88.60120000
12	Boalia Government School	Boalia, Rajshahi	6	24.37650000	88.57890000
13	Bogura Zilla School	College Road, Bogura	7	24.84890000	89.36980000
14	Sherpur Government College	Sherpur, Bogura	7	24.86340000	89.41560000
15	Khulna Zilla School	Boyra, Khulna	8	22.81890000	89.56010000
16	Daulatpur Government School	Daulatpur, Khulna	8	22.80890000	89.53450000
17	Jessore Government School	Chanchra, Jessore	9	23.17010000	89.20120000
18	Monirampur Degree College	Monirampur, Jessore	9	23.15670000	89.18780000
19	Sylhet Government Pilot High School	Zindabazar, Sylhet	10	24.89340000	91.87230000
20	M.C. College	Subhanighat, Sylhet	10	24.90120000	91.86980000
23	noakhali	noakhali	4	22.85963300	91.10262900
24	arib	arib	5	22.33276300	91.82649300
25	CHITTAGONG COLLEGE	College Road, Chattogram 4203	5	22.35376300	91.83772400
\.


--
-- Data for Name: polling_center_of_election; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.polling_center_of_election (id, polling_center_id, election_id) FROM stdin;
2	2	2
3	1	2
4	7	1
6	8	1
11	13	4
12	14	4
14	10	4
15	9	4
16	10	5
18	3	2
19	4	2
20	7	2
21	8	2
22	7	7
23	8	7
26	10	7
27	16	10
28	15	10
29	20	7
30	19	7
31	1	8
32	2	8
33	9	7
34	12	23
35	11	23
36	10	24
37	1	25
38	2	25
39	3	25
40	4	25
41	7	25
43	25	25
44	17	25
45	1	26
46	2	26
\.


--
-- Data for Name: role_map; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.role_map (id, election_id, role, relation_id, user_id) FROM stdin;
52	23	RO	42	9
53	23	PRO	34	7
54	23	PRO	35	8
55	23	PO	16	6
56	23	PO	17	11
57	23	PO	16	5
63	24	PRO	36	8
64	24	PO	19	3
65	24	RO	50	2
66	23	PO	18	3
67	25	RO	51	10
68	25	RO	52	8
69	25	PRO	37	12
70	25	PRO	38	6
71	25	PO	20	7
72	25	PO	21	5
73	25	PRO	39	9
74	25	PRO	40	11
75	25	PO	22	4
76	25	PO	23	3
78	25	RO	53	13
79	25	PRO	41	15
81	25	PO	24	14
82	25	RO	54	16
83	25	PRO	43	22
84	25	PO	25	18
85	25	RO	55	21
86	25	PRO	44	19
87	25	PO	26	20
88	26	RO	56	10
89	26	RO	57	7
90	26	PRO	45	6
91	26	PRO	46	12
92	26	PO	27	5
93	26	PO	27	8
94	26	PO	28	11
\.


--
-- Data for Name: sensitive_operations_request; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sensitive_operations_request (request_id, type, target_entity_id, approval_count, required_approvals, status, requested_by, requested_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, password, role, approved, created_at) FROM stdin;
1	Admin User	admin@election.dev	$2b$12$nGJk9nHRLb5dAwjR06217.1nH9lu0NcEW9E1vSeYgtGtIcIyXfedq	ADMIN	t	2026-04-02 19:13:44.277237+00
2	Returning Officer	ro@election.dev	$2b$12$PdadWmJWxnpCis9hXLPaC.fFW3/66v5nPqjNpmTvwSCZzkmdVtwme	USER	t	2026-04-02 19:13:44.694702+00
3	Polling Officer	po@election.dev	$2b$12$NlqUanN5SsNtNyvVJ02pBeXdI1kfudbLHCf4FNLE.sNHIVSqp12fa	USER	t	2026-04-02 19:13:45.09104+00
4	Mr. Decay	mrdecay@gmail.com	$2b$12$rQTP6lmmWeSvrEOWSxNTbe3FCiCMhLm9qu5ibrP/yCa/qrZY0.qXK	USER	t	2026-04-03 08:09:05.962737+00
12	Calcium Deficiency	calciumdeficiency@gmail.com	$2b$12$HLFmjY8ZnZjESfvJ.fLh/Oc/QLqOASV3sd2htjQZ81FbblPUWNbDG	USER	t	2026-04-03 19:11:12.542679+00
11	Mandy Candy	mandycandy@gmail.com	$2b$12$BLEcb1hPLwLNncqOOF8t6O0bSVDIorGMlPH2bCqOhDjnJpoaFhIei	USER	t	2026-04-03 19:10:03.410723+00
10	Aristotle	aristotle@gmail.com	$2b$12$gDbz9sWB2ZbZMqGzqoXrjeqLGekEjUWSoLvzthosfb.cUJEgrnqWS	USER	t	2026-04-03 19:08:47.38163+00
9	King in Yellow	kinginyellow@gmail.com	$2b$12$g667gO4fRqB3ayIiBJj9h.SqOmoujEFJvFMzzDEuHE7yxdYTjf.BC	USER	t	2026-04-03 19:07:57.595783+00
8	Kiki Holmes	kikiholmes@gmail.com	$2b$12$wVZMEXDkxA0IR3N91j9pk.tS039Qu4B2D2PXPe70tJyzKh1sVgCy.	USER	t	2026-04-03 19:06:24.52055+00
7	Donald J. Trump	donaldtrump@gmail.com	$2b$12$qDpkySR5GxquDtjAZZCtleCxIXgjn9MhBbvjxbLwP3folphXh6s6q	USER	t	2026-04-03 19:05:41.069877+00
6	Captain Celebrity	captaincelebrity@gmail.com	$2b$12$mGOKaPim.fWnkTxkJ/WHUeMgS5oRl0/axz.dJLOQw/ShuCrx2YSg6	USER	t	2026-04-03 19:04:53.956624+00
5	Joseph Joestar	josephjoestar@gmail.com	$2b$12$h961zuWbBr5TvcmRJ2prj.DT/NyjgXSVJOzmUbp5BdpQL9XBH99i.	USER	t	2026-04-03 19:03:52.605963+00
14	Sadman	sadman@gmail.com	$2b$12$PlTS/vZ3WnHH0lqIBM3N1.swvh5yHW3Y.McXNUXDfnRDydE2AuITe	USER	t	2026-04-04 07:06:18.099142+00
13	Turjjo 	tj@gmail.com	$2b$12$qniqy1Oc3fddrN39UOZ.GelTdsBK/dYcI9xoFhaKNTUdD1IVEhvOC	USER	t	2026-04-04 07:05:34.9139+00
22	fatin	fatin@gmail.com	$2b$12$4X2N3GRgn9sAG/tOdNJuWOQQbSp6gJ7tg0lFF64PhFg4Wvz5Xfz0W	USER	t	2026-04-04 07:12:27.105882+00
23	tajrian	tajrian@gmail.com	$2b$12$D583YeKHqFLwSx7NYYUi0.oAjod2rD9EZ.U/fEaCYDqeqm.DpqtWO	USER	t	2026-04-04 07:13:43.823141+00
21	ashfaq	ashfaq@gmail.com	$2b$12$enjQppeOXCVu/yo77FiEQukSWzQuElUayU1yz.WtjBmb.2hnJR88a	USER	t	2026-04-04 07:11:44.323334+00
20	safwan	safwan@gmail.com	$2b$12$JaKNTEi4mvaabHb0AH2nOOrmETdZZA17kEz0C4lqenaBStgKW97Nm	USER	t	2026-04-04 07:11:23.852345+00
19	jamee	jamee@gmail.com	$2b$12$KG5bRhWfq14fz.O6.SU4HOOe9v5E00f4Igjo9KPrSx1sgtD1/a166	USER	t	2026-04-04 07:10:27.782973+00
18	rajin	rajin@gmail.com	$2b$12$pOh5AWSJ8fPuHAmyibjS8uPii8zKXyF85slYiheSKTcS1oZU4KFAm	USER	t	2026-04-04 07:09:41.716131+00
16	aritro	aritro@gmail.com	$2b$12$5B.9vz2KvXooeKcOnNFl5OXhk3nNq8kOEEeuFVq21K8s6YfCdbQRG	USER	t	2026-04-04 07:08:31.508819+00
15	alu	alu@gmail.com	$2b$12$2F8CR5tTOnBm4HSOAWU.feaoW9NsPWFieIvErkztc/NYjW1YFHk2u	USER	t	2026-04-04 07:07:39.966447+00
24	Fahim	Fahim@gmail.com	$2b$12$j7rVRGjcLCEp5S/ezwZb..ZYEggKB45hdPKvgUi42ew8VgFNj/Ek6	USER	t	2026-04-04 07:14:27.477916+00
25	Fahim	fahim@gmail.com	$2b$12$31oDwRqx3erDe1/p7iUjw.rMK.dY.8ttY8ELO2Iwj9oiu/pzk2lJy	USER	f	2026-04-04 07:15:24.558601+00
26	Dibya	dibya@gmail.com	$2b$12$miQOf.75ByD9JfyqDqeZXe0oHSFY7CrR/Y7fCzACV06j.sjGNjfvi	USER	f	2026-04-04 07:15:41.747569+00
27	Abrar	abrar@gmail.com	$2b$12$FJ4gr5EbY2H/5QbJUv7CQOBvRsOb.bpYYUZF.KxrToCzpp/Qk0y6y	USER	f	2026-04-04 07:16:17.479081+00
28	john	john@gmail.com	$2b$12$Xi8pmSfbeSa3js3ld3Amt.tUkkrIx/9Oc/IiIl3PK1IK1fIvIHfdS	USER	t	2026-04-04 09:39:11.839163+00
\.


--
-- Data for Name: vote_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vote_log (vote_id, unit_id, candidate_id, batch_id, encrypted_choice, seq_number) FROM stdin;
\.


--
-- Data for Name: voter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.voter (nid, name, phone, email, voter_type, fingerprint_hash, constituency_id, lat, lng) FROM stdin;
00000001000000001	Shahana Begum	01214673281	ayesha@gmail.com	NORMAL	fp_69bf4d90ef769cf11e8354873310cd93	1	23.88113080	90.40283426
00000001000000002	Shahin Hossain	01167993273	kamalislam@outlook.com	NORMAL	fp_83a4fa3093e8ec8d2060d6204ea37764	2	23.77894471	90.35637870
00000001000000003	Shahid Khan	01638106930	shofiq@bdmail.net	NORMAL	fp_8d549c6538c6d033c7432f9b989877d9	3	23.98154089	90.42878201
00000001000000004	Nasrin Sultana	01247521058	karimmia@yahoo.com	NORMAL	fp_d23599f3e624e5f5e1a2c65fcb3c9ee3	4	22.37495933	91.78915249
00000001000000005	Shahana Begum	01300498565	salam35@yahoo.com	NORMAL	fp_030397b0546d8e5b071fa0674925d2c8	5	22.35678420	91.85595820
00000001000000006	Shahadat Ali	01729125917	shofiqchowdhury@gmail.com	NORMAL	fp_0ecb5a04bef08d67f02efc0445a62261	6	24.38599317	88.59562833
00000001000000007	Abdur Islam	01984035616	shirin@yahoo.com	NORMAL	fp_d047d3f0e786dbeb810a0e068447c606	7	24.82787509	89.36712107
00000001000000008	Md. Mostafa	01185034749	shofiq49@bdmail.net	NORMAL	fp_3ddfb507598b5189f1706412a85ec1f4	8	22.81111703	89.57127260
00000001000000009	Nazma Chowdhury	01425422746	rafiq@outlook.com	NORMAL	fp_27c3c4c44b280d2ccde72a8533819618	9	23.16108148	89.21358901
00000001000000010	Chowdhury Khan	01642698121	rabeya@bdmail.net	NORMAL	fp_98037bb6995deef26a2ec90f79b33424	10	24.87684785	91.85658598
00000001000000011	Shahriar Khan	01402688870	nasrin@gmail.com	NORMAL	fp_423ba4f7e67f16f8103cd34a4b44dc66	1	23.89473405	90.38620421
00000001000000012	Gias Ahmed	01951206598	chowdhury@yahoo.com	NORMAL	fp_4810523874483bf7b7cd562d32e15052	2	23.77981933	90.38628656
00000001000000013	Halima Khatun	01392422165	rabeya@hotmail.com	NORMAL	fp_fc7d8f16d0cb7cabcb2c9e133ac01846	3	23.98714189	90.43150683
00000001000000014	Ruma Islam	01130032687	rahimmia@hotmail.com	NORMAL	fp_207fe079873c3cc4000d4943076ac19d	4	22.37453257	91.77151767
00000001000000015	Shahinur Khatun	01205985181	fatema@outlook.com	NORMAL	fp_35272675102aedeaed681488f7630fd1	5	22.31278278	91.82890511
00000001000000016	Shah Das	01965914943	ahmed@yahoo.com	NORMAL	fp_54764493518ed962db174050b64e58d8	6	24.39591559	88.58878935
00000001000000017	Md. Rahim	01357046836	rafiq@outlook.com	NORMAL	fp_ef7b992b2034d1f09327c2f14e5d9d3f	7	24.85605304	89.38481567
00000001000000018	Parul Akter	01262596364	das@outlook.com	NORMAL	fp_54678e31a49eed3ab68571e57322e1a7	8	22.82051299	89.55425143
00000001000000019	Md. Rafique	01379994374	shirin@outlook.com	NORMAL	fp_a2bd0abe5acec08ec68836eeab3b1bd0	9	23.17442159	89.22297051
00000001000000020	Tania Rahman	01945316014	karim@yahoo.com	NORMAL	fp_8126008527f3861cd29daeb3c3464d62	10	24.88946152	91.88995736
00000001000000021	Shahin Sarker	01843258484	islam@gmail.com	NORMAL	fp_5b452c4a998a245eae23121a3fda8d44	1	23.87091410	90.35524674
00000001000000022	Shahin Ali	01189109547	khadija@outlook.com	NORMAL	fp_05a135787b5036b899d4a31cfafe4104	2	23.78577289	90.38066484
00000001000000023	Nargis Begum	01467772552	hossain@outlook.com	NORMAL	fp_a8f9e6bf8391fee9c94cace10a9d56a0	3	24.01953321	90.44424632
00000001000000024	Nasima Rahman	01439697471	shahana@hotmail.com	NORMAL	fp_e4fd8fc26505294a8c6471cf3c89b6bc	4	22.34594991	91.79916626
00000001000000025	Shamsul Ali	01398273848	shahindas@yahoo.com	NORMAL	fp_9662650562551b5537ca07e20cf5c9eb	5	22.34576267	91.83477227
00000001000000026	Saleha Begum	01129226389	ahmed@hotmail.com	NORMAL	fp_69579e9bf6df535b160129af115f13da	6	24.35286643	88.62574298
00000001000000027	Md. Shahed	01385892883	hasankhan@yahoo.com	NORMAL	fp_e955cf9acb30f5fc8277b23f5617f944	7	24.83218507	89.37273946
00000001000000028	Halima Khatun	01834181667	barkathossain@bdmail.net	NORMAL	fp_634d6cd8e273f1a90b4daac4e5c8f744	8	22.79338472	89.57942032
00000001000000029	Rina Khatun	01204783815	karimali@outlook.com	NORMAL	fp_0df8fb28672459de255c89505698fed8	9	23.14647201	89.19550684
00000001000000030	Lutfur Haque	01239497883	hasandas@yahoo.com	NORMAL	fp_4195e888a709c1262cfba921bc2df0fd	10	24.91448650	91.84473598
00000001000000031	Rabeya Khatun	01119259872	rahimchowdhury@hotmail.com	NORMAL	fp_e1e0cce8d0fa23b98e307d9a4fe1d132	1	23.88138705	90.35839503
00000001000000032	Shahnewaz Khan	01397896254	rokeya@hotmail.com	NORMAL	fp_1bdc420691e0ffaf070873dd60e29567	2	23.80128358	90.37346192
00000001000000033	Md. Shahidul	01334904153	islam@gmail.com	NORMAL	fp_6665536530b6683b836af676d0724f07	3	23.97897298	90.43080228
00000001000000034	Md. Shahed	01372784928	shahinmia@outlook.com	NORMAL	fp_5aebd5b140c87784f29e031f00ee03cf	4	22.36089767	91.79896077
00000001000000035	Shamsul Sarker	01213669700	parvin@outlook.com	NORMAL	fp_157fc323992161ebcaabc81aed5c52bd	5	22.32562471	91.85621309
00000001000000036	Lutfur Haque	01684473258	ahmed@yahoo.com	NORMAL	fp_fda4f5e071a8d8efa54646353b402877	6	24.35178931	88.60637049
00000001000000037	Abu Ahmed	01584320887	hasanali@hotmail.com	NORMAL	fp_ec52d47adc0cafa1560e0fde9258fd77	7	24.86461459	89.35911946
00000001000000038	Halima Khatun	01340099219	rafiq37@outlook.com	NORMAL	fp_e23e6cfc69f20f271ef1804726d34079	8	22.83284137	89.57547391
00000001000000039	Abu Hossain	01597653872	rabeya@hotmail.com	NORMAL	fp_c98de28f4cdb1308e668945359fcaba9	9	23.18106592	89.19003606
00000001000000040	Nasrin Sultana	01202674560	hossain@gmail.com	NORMAL	fp_ee23a67e0a955e8b249df24fa0fcbc4c	10	24.90867739	91.85781320
00000001000000041	Md. Shamsul	01144237982	nargis@yahoo.com	NORMAL	fp_16e9f777b8f00bab3419711153435807	1	23.85568680	90.38589026
00000001000000042	Farida Akter	01267279700	jamal@hotmail.com	NORMAL	fp_bceaa5773eb97cef9e05b0f91272d8b4	2	23.76394694	90.38213870
00000001000000043	Mst. Sultana	01514841678	hasan78@hotmail.com	NORMAL	fp_9b1d3f3a3f329168dd2ee13390d14355	3	24.00726828	90.39611714
00000001000000044	Shirin Begum	01162997724	karim68@outlook.com	NORMAL	fp_86819d2845302bf35b416be8480591d0	4	22.34232258	91.79779057
00000001000000045	Rabeya Khatun	01906248186	sarker@gmail.com	NORMAL	fp_f229ebf58ef6108cff5be2b3831c1101	5	22.34708410	91.84010179
00000001000000046	Morjina Mia	01759829406	rafiqali@gmail.com	NORMAL	fp_fdcbe426f87f82e121c050754b153522	6	24.38688198	88.62707746
00000001000000047	Muhammad Sarker	01238463199	hasanislam@yahoo.com	NORMAL	fp_bac3ff615c3d0bd36ef1f2293257425d	7	24.85900377	89.35042028
00000001000000048	Parvin Begum	01862636674	shahana@outlook.com	NORMAL	fp_1a4d758a47eed5bfe28e4d6cd388a982	8	22.79329745	89.55908230
00000001000000049	Shahnaz Begum	01639641052	shahinhossain@bdmail.net	NORMAL	fp_f8dd4483da851f29e256d00c474c582a	9	23.17126564	89.21300834
00000001000000050	Ruma Rahman	01990664382	jamal88@yahoo.com	NORMAL	fp_9d4cd716762a0e2a73248b0815177ef6	10	24.88910725	91.87663693
00000001000000051	Ahmed Rahman	01989129883	khadija@outlook.com	NORMAL	fp_29b156a7c95dcb892fb60fb09499a3a8	1	23.89507053	90.35705784
00000001000000052	Shahrukh Islam	01538038712	jamalahmed@yahoo.com	NORMAL	fp_2c888a581271fd6055e33a9d08fc1ca6	2	23.77867447	90.36713047
00000001000000053	Shahana Begum	01479198896	chowdhury@yahoo.com	NORMAL	fp_0caf85d3eb650f19443cbb2b2642d634	3	24.01514207	90.44267278
00000001000000054	Nipa Khan	01168258649	karimchowdhury@yahoo.com	NORMAL	fp_17ac501c71ca8a28e732ede333d7c0fc	4	22.33918096	91.76992903
00000001000000055	Nargis Begum	01712928558	hossain@outlook.com	NORMAL	fp_e48c3bdce9633afb1d8b121a9c56fcf8	5	22.34679576	91.85649943
00000001000000056	Nasima Sultana	01410548958	khadija@hotmail.com	NORMAL	fp_5a560f93da8b29d4efe316c44f37791a	6	24.37365074	88.59901487
00000001000000057	Saleha Begum	01163238850	shofiqchowdhury@hotmail.com	NORMAL	fp_2513d93a77ba75509bb4adf58e3cd2d1	7	24.85917330	89.34845347
00000001000000058	Fatema Begum	01861134626	nasrin@yahoo.com	NORMAL	fp_bab48e525505a0379311374af92989ad	8	22.81703902	89.58109809
00000001000000059	Abul Hossain	01311617223	rahim15@outlook.com	NORMAL	fp_802468b5df257a8eb4bc999b905a2cc6	9	23.16545693	89.21026727
00000001000000060	Md. Rafiq	01272292791	jamalali@outlook.com	NORMAL	fp_c0fecc98aa68325c9ef88b8fe34a7e79	10	24.91762124	91.85435231
00000001000000061	Abul Rahman	01278965529	rokeya@hotmail.com	NORMAL	fp_37c3fb3144e6799e1bb0f7de8faa2ebd	1	23.85142041	90.39330529
00000001000000062	Rabeya Khatun	01150453517	sarker@outlook.com	NORMAL	fp_a7107ea5e089b557c3e8ff60282cfee7	2	23.75708678	90.38425971
00000001000000063	Ms. Rahman	01277395053	chowdhury@gmail.com	NORMAL	fp_f9878a80ca687f1afdcdd9d9291d7507	3	23.99370565	90.40532509
00000001000000064	Mir Mia	01986443898	fatema@yahoo.com	NORMAL	fp_2a8e3d431eba542c0c50b6ec9e1faa88	4	22.33386592	91.77837925
00000001000000065	Abul Sarker	01224224793	barkatsarker@bdmail.net	NORMAL	fp_c32d5e172a46f540d0c87c435ac86ce8	5	22.34394305	91.81252055
00000001000000066	Shamima Akter	01314273679	rahim@hotmail.com	NORMAL	fp_afea59135563a391a47c648accc94359	6	24.36775639	88.62371147
00000001000000067	Dina Rahman	01246609628	salam@outlook.com	NORMAL	fp_4704db93a8152b23f13b7ca96600d94b	7	24.84358194	89.39268422
00000001000000068	Marium Islam	01407238790	rabeya@gmail.com	NORMAL	fp_2666a30aea1ab91644cc26c44c1fcbcc	8	22.79776842	89.54072749
00000001000000069	Ayesha Hossain	01657421425	mia@yahoo.com	NORMAL	fp_f3f66354e5d5af1b5ad324583ed4c658	9	23.18289346	89.21395893
00000001000000070	Nasima Khan	01255905090	ahmed@yahoo.com	NORMAL	fp_80e28cb2260fd81bff21e5c852f1d9c2	10	24.87331048	91.87865904
00000001000000071	Lutfur Islam	01600149099	rafiqdas@outlook.com	NORMAL	fp_42871224f10e3ec74cb0c0acf4cdb556	1	23.89041004	90.35546019
00000001000000072	Md. Mostafa	01940954078	islam@bdmail.net	NORMAL	fp_9f563f6ed0e6ae73aef6537b97610ad5	2	23.76323566	90.36734047
00000001000000073	Md. Salam	01801189194	chowdhury@yahoo.com	NORMAL	fp_eadb20b28d31416b69b024fd262fcbb7	3	23.98522417	90.41564023
00000001000000074	Shahana Jahan	01642715654	salamhossain@outlook.com	NORMAL	fp_1646341f05e2d23368ec945ce383e127	4	22.37156511	91.76183514
00000001000000075	Shamima Begum	01448954296	kamal61@hotmail.com	NORMAL	fp_b5f3f14050f53c446c93b8c28572a430	5	22.33695500	91.83283832
00000001000000076	Ms. Rahman	01264536549	khadija@gmail.com	NORMAL	fp_2b1c14772cdf602a919f71c1b21fa53c	6	24.36166993	88.58020559
00000001000000077	Marium Rahman	01519659208	jamalahmed@yahoo.com	NORMAL	fp_fb00cf903b66f32f50f6719e40a9f462	7	24.84699424	89.37657214
00000001000000078	Shah Khan	01325257637	salamhossain@hotmail.com	NORMAL	fp_8cf1055a6c1d4d5b320df9a723fab427	8	22.80061230	89.57941458
00000001000000079	Rabeya Khatun	01663786244	salamchowdhury@yahoo.com	NORMAL	fp_51a19220fb4cc325270c76676e624b60	9	23.16711806	89.19023501
00000001000000080	Saleha Jahan	01876382256	sarker@yahoo.com	NORMAL	fp_8be3d39e601491b4f894185210f469ae	10	24.91940995	91.88244148
00000001000000081	Saleha Begum	01592352859	parvin@outlook.com	NORMAL	fp_a71ed1e0eab3e3fd0fd489438d306905	1	23.89150610	90.35667610
00000001000000082	Shahnaz Begum	01220563731	shahinislam@outlook.com	NORMAL	fp_34cefbc739a5e4c303cb1efc6e74734c	2	23.77504613	90.39467765
00000001000000083	Shahida Sultana	01228282231	islam@bdmail.net	NORMAL	fp_276a79117837751d206509869bd8f4bd	3	24.01139954	90.42702316
00000001000000084	Marium Chowdhury	01856243370	khan@yahoo.com	NORMAL	fp_101a067666c7c94e2b2283ddd5c0694a	4	22.35822112	91.76643288
00000001000000085	Shah Sarker	01983271784	hossain@yahoo.com	NORMAL	fp_0beadc6adac432518b2d8593f3e706e2	5	22.31738749	91.83556829
00000001000000086	Md. Jamal	01257930164	shahin27@bdmail.net	NORMAL	fp_0294a2780d0b521320b7eff6aecc3cae	6	24.39562034	88.60126034
00000001000000087	Md. Shahidul	01300713020	hasan56@outlook.com	NORMAL	fp_d43d6daaa4119236fd460c416053ae38	7	24.85218151	89.36623312
00000001000000088	Mina Sultana	01666264243	rafiq@yahoo.com	NORMAL	fp_685618109a61e6f3ad3e96ddace38f19	8	22.80810605	89.54128188
00000001000000089	Nasima Akter	01521110804	chowdhury@bdmail.net	NORMAL	fp_0201106a5ec7adf7b1b0b3a40cb1da79	9	23.16661723	89.20290202
00000001000000090	Nasrin Begum	01217733748	rahman@outlook.com	NORMAL	fp_7fb8db3fd3c272e6e15513250643055a	10	24.90921504	91.85997058
00000001000000091	Shahinur Islam	01264951123	sarker@hotmail.com	NORMAL	fp_e50ea5b6d47947f15bb9374217f46cd6	1	23.86071668	90.38276007
00000001000000092	Nasima Rahman	01411083306	hasanhossain@yahoo.com	NORMAL	fp_53bda426632933891cfe10151c2af0e4	2	23.77087741	90.38769468
00000001000000093	Shahjahan Mia	01688044183	hossain@yahoo.com	NORMAL	fp_876b346eb4a476330f80cad75835672f	3	24.00674922	90.41077820
00000001000000094	Shah Ahmed	01788562833	mia@outlook.com	NORMAL	fp_4971d3e5ae1ff3e996291a0e9d3778be	4	22.37266852	91.80580881
00000001000000095	Tania Begum	01431758355	parvin@outlook.com	NORMAL	fp_5f1c5b20e88a81b084808f35744ec1d7	5	22.33471090	91.83970956
00000001000000096	Rabeya Akter	01193355787	das@gmail.com	NORMAL	fp_df2894e93044b907e55c8c9f886adb35	6	24.37713093	88.59444762
00000001000000097	Nargis Akter	01425581035	salam38@hotmail.com	NORMAL	fp_4e7bbef9a2f813fc2aa9306e3ad2104c	7	24.82864936	89.38235338
00000001000000098	Parvin Begum	01464103919	karimhossain@yahoo.com	NORMAL	fp_3d8e52529292e749c3e585dff6336423	8	22.79561217	89.56592914
00000001000000099	Md. Shamsul	01985213323	das@outlook.com	NORMAL	fp_2cb38f70c62ef0814799caf5b1f1f6f1	9	23.16815139	89.22109301
00000001000000100	Nur Das	01394512053	parvin@gmail.com	NORMAL	fp_557650dfb4777f374a838b55176bceb6	10	24.87730160	91.85297543
00000001000000101	Md. Nurul	01224480335	ayesha@outlook.com	NORMAL	fp_f7ee9f98e36c79b15b0050ae2c19a9b1	1	23.85901304	90.38238137
00000001000000102	Tania Khatun	01629438953	karimrahman@outlook.com	NORMAL	fp_483b5d2981923f3195ca2fc7844e7a00	2	23.77923512	90.35936812
00000001000000103	Abul Das	01521795835	shirin@outlook.com	NORMAL	fp_6e1a77142dc36c39bb9784750d4dc3f2	3	23.98865223	90.42299769
00000001000000104	Golam Sarker	01798119096	salam44@yahoo.com	NORMAL	fp_9b4b8d1db81984ebf5dad9778f664a71	4	22.33894720	91.79040442
00000001000000105	Md. Shahidul	01850549985	rabeya@yahoo.com	NORMAL	fp_13cc367ce80f6b6d302f542d3da561cb	5	22.35341411	91.83853400
00000001000000106	Sultan Ahmed	01899194055	karimislam@hotmail.com	NORMAL	fp_c199bc1e4b419afe801f3e0e4b6341d9	6	24.39547494	88.61844468
00000001000000107	Rabeya Khatun	01316435807	sarker@hotmail.com	NORMAL	fp_bf57ac70fb32f22c716b25bc3b88ecce	7	24.87535000	89.35861527
00000001000000108	Md. Barkat	01809833846	jamalhossain@hotmail.com	NORMAL	fp_f19bdcff2841a74e8bc6652b51ec8a7e	8	22.79253695	89.54912166
00000001000000109	Shirin Hossain	01272974841	shirin@yahoo.com	NORMAL	fp_4c6f64c880d84e91391a722b87dfcd5d	9	23.17936366	89.19149274
00000001000000110	Shah Hossain	01408157173	das@hotmail.com	NORMAL	fp_99ddfdd85d530775a6afe75dd46416c6	10	24.90048513	91.87077017
00000001000000111	Md. Salam	01978340871	rafiqislam@hotmail.com	NORMAL	fp_155543d6fd7f98f2f1f3c7105d605e68	1	23.87192882	90.35783079
00000001000000112	Parvin Rahman	01299201387	rahimmia@outlook.com	NORMAL	fp_93f939c54ba492d24b6ade55769355e6	2	23.76930788	90.39453100
00000001000000113	Jahanara Begum	01303588227	rokeya@gmail.com	NORMAL	fp_9d383b3385835f7cfb74cc14276d4735	3	23.97524260	90.41215730
00000001000000114	Marium Khatun	01216278721	ali@hotmail.com	NORMAL	fp_3f4d6a1d8302c43ff0a6a8500bcc82fa	4	22.34071061	91.76485063
00000001000000115	Mohammad Sarker	01374207440	mia@outlook.com	NORMAL	fp_a23bc7244ee9c8c2e161d61c38ae61ec	5	22.34726343	91.83524367
00000001000000116	Abu Hossain	01536587082	chowdhury@yahoo.com	NORMAL	fp_13ccbad2213d51700fb3106cf352e0e5	6	24.35373133	88.58659701
00000001000000117	Md. Shahid	01631901980	shahin@hotmail.com	NORMAL	fp_b8d52a18c98600b043dd9d0dff2c29e7	7	24.83564279	89.35441457
00000001000000118	Ruma Hossain	01615783990	shahana@yahoo.com	NORMAL	fp_5eb085d339787be70c8fa7c5fd89b90c	8	22.80264181	89.54678222
00000001000000119	Morjina Jahan	01521805988	hasanmia@gmail.com	NORMAL	fp_91bf5febb7c538046eff1b39a796d762	9	23.17153348	89.19898130
00000001000000120	Abul Mia	01483290654	rahim@gmail.com	NORMAL	fp_994462cce7390db404b62338efae99d3	10	24.90830010	91.87553346
00000001000000121	Muhammad Chowdhury	01666917374	das@hotmail.com	NORMAL	fp_3b33b14c6273b0f0d9a78a9009407ff1	1	23.86964100	90.39111510
00000001000000122	Khadija Akter	01427371939	chowdhury@yahoo.com	NORMAL	fp_d48418e4bb20ae86834a64b93ca6b5cd	2	23.79187932	90.38927294
00000001000000123	Mir Chowdhury	01420708620	nasrin@yahoo.com	NORMAL	fp_065a01c1fee46b85bc3ff8b1d86c456f	3	24.02039411	90.39592535
00000001000000124	Mir Islam	01913403910	jamalahmed@yahoo.com	NORMAL	fp_22b02de8a69615306258c0912f341380	4	22.33707891	91.78725403
00000001000000125	Rina Rahman	01291169061	salam66@hotmail.com	NORMAL	fp_a0dbb7f9ec89af7b4d5f7a9fe8059040	5	22.33870720	91.84537450
00000001000000126	Shahid Islam	01745600132	jamal@hotmail.com	NORMAL	fp_be91ff1f23122f81894359bd90f33dc8	6	24.38504696	88.58584055
00000001000000127	Rokeya Khan	01729162327	salam@hotmail.com	NORMAL	fp_863d4894270a8f3190e523998b6e88c8	7	24.87299316	89.35404025
00000001000000128	Shahida Rahman	01757926665	salam74@bdmail.net	NORMAL	fp_c52032a311ab3e85fee37333bd0b09f3	8	22.79910278	89.57340335
00000001000000129	Shirin Hossain	01364871777	nasrin@gmail.com	NORMAL	fp_7720a0636956319cbff4c5f7013f2d41	9	23.16211106	89.21504103
00000001000000130	Halima Begum	01622548137	rahman@yahoo.com	NORMAL	fp_23d8d18a6522de2206d70105742665cb	10	24.91502763	91.85931502
00000001000000131	Nasrin Begum	01918604190	sarker@gmail.com	NORMAL	fp_e6c77b7e821f7079a2543ded16c83a56	1	23.86316519	90.37325778
00000001000000132	Ahmed Rahman	01351049035	islam@yahoo.com	NORMAL	fp_416ce5857f31e11238bae23e708c17b5	2	23.78848651	90.37136671
00000001000000133	Shahinur Sultana	01848063372	rahimsarker@bdmail.net	NORMAL	fp_1d80b7725ba1d42533648a1d3b1f3ea0	3	23.99988627	90.43416888
00000001000000134	Shahid Alam	01121131095	sarker@yahoo.com	NORMAL	fp_dd5841a27188b7b85e8acee048c061b8	4	22.36209835	91.79443445
00000001000000135	Nazma Chowdhury	01321444804	karimhossain@yahoo.com	NORMAL	fp_8efb8f75882eeb37f15e448b5c771527	5	22.34359531	91.85092794
00000001000000136	Gias Khan	01722497097	rafiqrahman@yahoo.com	NORMAL	fp_085a4b872d0acc065b22fc6843338c0b	6	24.39891907	88.62376757
00000001000000137	Fatema Begum	01865928078	hasankhan@hotmail.com	NORMAL	fp_25a8e110a52304baa338ecd2eedf92c8	7	24.82789089	89.35425153
00000001000000138	Md. Karim	01274614557	parvin@outlook.com	NORMAL	fp_6b8c6673bc913ddd90a5390342e3ed01	8	22.82772972	89.54421050
00000001000000139	Quazi Sarker	01673485871	salam@yahoo.com	NORMAL	fp_689ec32d9b7915ea37f69f23140868c1	9	23.18381354	89.20666296
00000001000000140	Md. Shahed	01234179187	salamkhan@hotmail.com	NORMAL	fp_3bf5e42570b4b758c502350bc0d9b487	10	24.88705984	91.85553361
00000001000000141	Syed Khan	01311981929	karim@bdmail.net	NORMAL	fp_0eab6e0a8628110726970d08f0b3ee91	1	23.85965937	90.37183734
00000001000000142	Shahana Begum	01832689538	karim75@outlook.com	NORMAL	fp_72f06b6810376de9f9e3d76991666780	2	23.79749125	90.36778212
00000001000000143	Nasima Das	01830471599	parvin@hotmail.com	NORMAL	fp_4ff9a3a0fced1140c62b3ff13ce573d3	3	23.98282889	90.44069287
00000001000000144	Md. Shahed	01944805263	shofiqali@gmail.com	NORMAL	fp_ac4981119c249379f13904d98f3465fb	4	22.36418726	91.78173686
00000001000000145	Lima Akter	01411500718	khadija@hotmail.com	NORMAL	fp_bdad7055ec26820bbd3dffe4758c198f	5	22.31536471	91.81210367
00000001000000146	Shahana Khatun	01820702835	shirin@gmail.com	NORMAL	fp_750ae522f3ffd073dcd7467b847f569e	6	24.39753928	88.59832981
00000001000000147	Mohammad Ahmed	01119411964	rafiqali@yahoo.com	NORMAL	fp_d0c80a717ceac3f28d71816e604e9044	7	24.83333538	89.36867236
00000001000000148	Md. Mostafa	01171928642	salamali@hotmail.com	NORMAL	fp_f596d028fd53929438b4143116251f2f	8	22.82753388	89.55319083
00000001000000149	Nipa Jahan	01941562282	kamalsarker@hotmail.com	NORMAL	fp_d0b8feac7e297015d29b51b81dc75105	9	23.18112661	89.18439181
00000001000000150	Shahrukh Hossain	01960642825	salamrahman@bdmail.net	NORMAL	fp_bc525f1e618c743b2984c5953107be82	10	24.87881333	91.88659487
00000001000000151	Nasrin Begum	01466766249	chowdhury@yahoo.com	NORMAL	fp_afd29213d4b017c65099351d470ebfa9	1	23.88729562	90.35678058
00000001000000152	Shahid Ali	01342026410	kamalali@yahoo.com	NORMAL	fp_e96cb9efc314154108d8d4b4d7f17df5	2	23.79524772	90.36758439
00000001000000153	Nur Islam	01689819905	shofiq47@yahoo.com	NORMAL	fp_a9987871d4569d788bc02ff0e6c6656f	3	24.01005677	90.40960240
00000001000000154	Nasrin Khan	01568895377	shirin@hotmail.com	NORMAL	fp_d9d727cee54a34ef3b0ecbd0e03ebb60	4	22.33429140	91.77984549
00000001000000155	Marium Khan	01772926284	salammia@hotmail.com	NORMAL	fp_c109957ddf821143675cce98c11b3cb8	5	22.31259883	91.81844413
00000001000000156	Nazma Khan	01840734652	khadija@hotmail.com	NORMAL	fp_5759db9c50a6bebe77fd8e75f9aaa84b	6	24.37850745	88.61683006
00000001000000157	Mrs. Hossain	01556954198	karimrahman@outlook.com	NORMAL	fp_7c1866fe6be20505307a33042f68d12a	7	24.86527663	89.38775784
00000001000000158	Mir Haque	01868270399	shahana@gmail.com	NORMAL	fp_1cad38f9cb334e80cbc214841a6316f6	8	22.80802743	89.53618165
00000001000000159	Rokeya Begum	01387686524	das@yahoo.com	NORMAL	fp_9b6f9c0ee4db8454e4e29262d7579e6f	9	23.16290208	89.21426037
00000001000000160	Lima Hossain	01874533312	shofiqkhan@outlook.com	NORMAL	fp_4350d260212fc624a3b60f9b11f913bd	10	24.90308001	91.84935138
00000001000000161	Khadija Sultana	01801986052	kamal@gmail.com	NORMAL	fp_341edc13aafe38385f687e9170f77a23	1	23.86281029	90.39948523
00000001000000162	Shahrukh Mia	01873037337	rokeya@outlook.com	NORMAL	fp_51e5f5d02a8554d40fe776447382498c	2	23.75676183	90.36532749
00000001000000163	Shirin Hossain	01229752420	hossain@yahoo.com	NORMAL	fp_27c1c26b18e6e9481a1a3af969c4488e	3	24.01545844	90.43324059
00000001000000164	Ripa Sultana	01887956445	kamal@gmail.com	NORMAL	fp_8b812f5398c6e7f457e18ba166e788a6	4	22.37738430	91.77067722
00000001000000165	Chowdhury Khan	01751352261	kamal43@outlook.com	NORMAL	fp_9815fb65b1ad0c7f32bda9fcce8aea14	5	22.34615003	91.85375650
00000001000000166	Jahanara Begum	01889269315	jamal@yahoo.com	NORMAL	fp_c4488db18934baa1af410b4ed0a25d1d	6	24.37422349	88.61591271
00000001000000167	Shahnaz Mia	01627521456	nargis@bdmail.net	NORMAL	fp_16b23b0183c58704b49bda4a3ccf5130	7	24.85960733	89.39147925
00000001000000168	Halima Chowdhury	01163795696	chowdhury@hotmail.com	NORMAL	fp_70634930e1a19664a977e172ff6e7186	8	22.80398835	89.57804346
00000001000000169	Nasrin Begum	01548310596	kamal9@outlook.com	NORMAL	fp_25a314b44cb9c27e045d364f6f7b5684	9	23.16648113	89.19015447
00000001000000170	Mohammad Mia	01612218246	jamal@yahoo.com	NORMAL	fp_276317959974b29dbc4bfc5c1abd0f9e	10	24.91387255	91.89125927
00000001000000171	Md. Shahid	01584294331	islam@hotmail.com	NORMAL	fp_e51dcfecd6eb7533f2a278efa224553b	1	23.85531205	90.37903539
00000001000000172	Syed Hossain	01190728723	islam@yahoo.com	NORMAL	fp_2daca95cad25cb1a7d1b0c1beef6864c	2	23.75546345	90.37332845
00000001000000173	Rina Begum	01979655522	salam41@hotmail.com	NORMAL	fp_aebdebccfbcd1e2054319d3ec89731e8	3	23.99610582	90.40358398
00000001000000174	Abul Chowdhury	01703184137	shahindas@yahoo.com	NORMAL	fp_692b6ce6eec58e5e16f83b0f307e567e	4	22.33384055	91.75821427
00000001000000175	Shahin Rahman	01544675182	rafiqsarker@hotmail.com	NORMAL	fp_299480bc5ba0337db41b2909ee098132	5	22.33721652	91.84369941
00000001000000176	Shahadat Ali	01653095673	rafiqchowdhury@hotmail.com	NORMAL	fp_e655a9a5ec55621bc10e4dadc3b48506	6	24.35251901	88.59468911
00000001000000177	Nazma Sultana	01445833993	khan@outlook.com	NORMAL	fp_5bb5ac31c859e07c06ef7bc24b434648	7	24.86233637	89.37063890
00000001000000178	Md. Barkat	01857506104	karim13@gmail.com	NORMAL	fp_5db204a80d695593a147373263489d08	8	22.83644649	89.53945436
00000001000000179	Farida Das	01789191442	rahman@outlook.com	NORMAL	fp_f5ab2060eea88a94ffb597485efed8bc	9	23.15538774	89.22207378
00000001000000180	Shahnewaz Ali	01548642362	rokeya@yahoo.com	NORMAL	fp_16324b7f2bd8f8ee2e3bcf5e0b5b4d32	10	24.90134234	91.88233420
00000001000000181	Shahnaz Hossain	01181909549	chowdhury@yahoo.com	NORMAL	fp_b04e559130f8f0a75fec1023de18ff4e	1	23.85825855	90.40345937
00000001000000182	Saleha Akter	01496821877	chowdhury@outlook.com	NORMAL	fp_6cd0b623d663a153ec66e4325b143e9c	2	23.80490354	90.35870032
00000001000000183	Chowdhury Khan	01291966475	kamalali@outlook.com	NORMAL	fp_80d2d8dc018feecca4998d21432dcf8c	3	23.98038550	90.40765862
00000001000000184	Nasima Islam	01734342070	ahmed@gmail.com	NORMAL	fp_369699c9955a39ed7c7f03a1a602d68c	4	22.35815843	91.75906004
00000001000000185	Md. Shofiq	01283042534	shahinahmed@hotmail.com	NORMAL	fp_b0c266b8091f6fcdc95dee85f3acadfc	5	22.34479195	91.82435239
00000001000000186	Muhammad Mia	01269794448	khadija@hotmail.com	NORMAL	fp_85154c1ab7d5dab3fd3f1a1d6fd41786	6	24.36889060	88.62721961
00000001000000187	Md. Barkat	01774971737	shahin@hotmail.com	NORMAL	fp_51e5d6d57bdf56ab677b64d4b806c80e	7	24.83245328	89.37435131
00000001000000188	Md. Morshed	01274035305	karim33@hotmail.com	NORMAL	fp_400362d4498433dd2986f251893d9cdd	8	22.80621995	89.54245143
00000001000000189	Shahida Rahman	01584733384	karim@outlook.com	NORMAL	fp_3200f084dce49d581243c85050982b05	9	23.15065183	89.20909113
00000001000000190	Shahnaz Khan	01654488151	ahmed@gmail.com	NORMAL	fp_a13113fff3cc590dd3bb02b0215e6543	10	24.87111488	91.88619955
00000001000000191	Mrs. Sultana	01399313697	rafiq47@hotmail.com	NORMAL	fp_c6ab29fae35118ea6906392e1221193a	1	23.88322477	90.37234972
00000001000000192	Nur Mia	01689812142	shirin@hotmail.com	NORMAL	fp_fe714a6a887d0cc1084de355fdd4cc14	2	23.77537209	90.36103428
00000001000000193	Marium Sultana	01804781975	das@hotmail.com	NORMAL	fp_ce26da2303bb924bfbe0920013ebdb8c	3	23.98618431	90.41891981
00000001000000194	Parul Rahman	01288967611	shahin5@outlook.com	NORMAL	fp_36938ab35c9debe45ec87ae049080e79	4	22.37315617	91.79325672
00000001000000195	Md. Shofiq	01276119319	sarker@hotmail.com	NORMAL	fp_1432f0280b6e00f50a92392923910d5d	5	22.34014551	91.81857053
00000001000000196	Ahmed Chowdhury	01336870933	rokeya@hotmail.com	NORMAL	fp_99536257ab352ae09d6a98237058c4b1	6	24.38482551	88.62789067
00000001000000197	Shah Ali	01624478863	barkat@outlook.com	NORMAL	fp_442f2460ce29c617f4b76f8976d1cf18	7	24.86798445	89.39056084
00000001000000198	Khadija Khatun	01956740435	hasan@hotmail.com	NORMAL	fp_97e0f88231dcb5dc1c169b07c6f98086	8	22.83894809	89.58188612
00000001000000199	Md. Mostafa	01545344004	nargis@hotmail.com	NORMAL	fp_031b2aad5d142d9fac47f341199c9db1	9	23.17742736	89.19643492
00000001000000200	Chowdhury Khan	01159093304	shirin@hotmail.com	NORMAL	fp_96198b90b4d69b042f31c3814d9bd43e	10	24.87260677	91.85572997
00000001000000201	Abul Mia	01783561075	parvin@yahoo.com	NORMAL	fp_5391c3ab329454e209c52018787fb4f2	1	23.89844597	90.35872202
00000001000000202	Morjina Islam	01545059916	hasan@outlook.com	NORMAL	fp_5733a20e654f9f9766a838a83a72df62	2	23.80046138	90.39290260
00000001000000203	Md. Mostafa	01948966270	shahinsarker@outlook.com	NORMAL	fp_66a564caba017d01e952e38a9963c268	3	24.02289241	90.39758962
00000001000000204	Ahmed Mia	01374171077	barkat@outlook.com	NORMAL	fp_52dfbd3319006b6977c89a4c5a518e52	4	22.35513643	91.76941702
00000001000000205	Ms. Chowdhury	01976986254	shofiq@hotmail.com	NORMAL	fp_05aff56d34e653fe2e6b279b63bd4a7e	5	22.31504869	91.83992548
00000001000000206	Abul Das	01277209913	islam@hotmail.com	NORMAL	fp_55ac5491343aad0e8f7b99376cf1fdfc	6	24.39401237	88.61457864
00000001000000207	Parul Jahan	01177263831	jamal@bdmail.net	NORMAL	fp_a2e700ed50d95fb3c381e80b790b3a40	7	24.82825004	89.38055910
00000001000000208	Rina Sultana	01259414863	khan@outlook.com	NORMAL	fp_b58dfaa682652e7b49141e7bc3752f31	8	22.79126450	89.56915189
00000001000000210	Nazma Chowdhury	01141328078	shahana@yahoo.com	NORMAL	fp_1a6612e1551e4b22276313faf2a4368b	10	24.87306050	91.86598295
00000001000000211	Shahnaz Akter	01891962340	das@yahoo.com	NORMAL	fp_447867b46cf3f33e7b490cee5625c5fa	1	23.89008951	90.39225572
00000001000000212	Md. Jabbar	01422099392	hossain@outlook.com	NORMAL	fp_37a29719ed5c6a42e1188efeff72b4f8	2	23.78681895	90.37910157
00000001000000213	Abu Das	01524186873	jamalislam@yahoo.com	NORMAL	fp_3e9deb9cbb16a2af498f5c026aafcf61	3	23.98677301	90.40543410
00000001000000214	Md. Jabbar	01933323080	shahinkhan@bdmail.net	NORMAL	fp_3632fc3b6823efb4747d2f540766a45c	4	22.37075833	91.77785529
00000001000000215	Mst. Sultana	01404500228	das@yahoo.com	NORMAL	fp_668c79210501947b30f45841608f1546	5	22.32069757	91.81987079
00000001000000216	Ahmed Hossain	01495640581	islam@yahoo.com	NORMAL	fp_26b8455ca15660b2b0c5c229d1b909f4	6	24.36766234	88.59606871
00000001000000217	Md. Rafiq	01545417274	rokeya@outlook.com	NORMAL	fp_0c83aaac2e5225f96a63956600fd411a	7	24.87585687	89.35795205
00000001000000218	Morjina Khan	01918924069	shofiqali@outlook.com	NORMAL	fp_5ac5293142983754e6094bf24d55f50c	8	22.83648600	89.53464126
00000001000000219	Ms. Rahman	01473496962	parvin@yahoo.com	NORMAL	fp_26d965cc40953e9fa6b7eb741767b351	9	23.15112211	89.19138118
00000001000000220	Parvin Islam	01488672023	salamhossain@hotmail.com	NORMAL	fp_7021e2685a1b79c2023e17a25975bfe7	10	24.87993791	91.84550045
00000001000000221	Mir Mia	01831929692	shofiqkhan@yahoo.com	NORMAL	fp_b7688327eed6405a932daa2689d3bb75	1	23.88571592	90.38037779
00000001000000222	Ms. Khatun	01257608490	nargis@hotmail.com	NORMAL	fp_6d7678211bc86eae2bb984fac5f65ac6	2	23.79097126	90.36380407
00000001000000223	Mohammad Rahman	01101371471	kamal@outlook.com	NORMAL	fp_bb979d39259c751405f0a76ca41aff88	3	24.00464717	90.40148656
00000001000000224	Shah Islam	01276191256	parvin@yahoo.com	NORMAL	fp_11aeec289d4f5d48bdeb9d8f36d09ef2	4	22.36282233	91.80681469
00000001000000225	Nazma Khatun	01951946528	rafiq78@outlook.com	NORMAL	fp_97e1ff13a77e8f9602e80b358f9ea19a	5	22.32940512	91.85219309
00000001000000226	Shila Islam	01307185974	fatema@bdmail.net	NORMAL	fp_e8afa4458c1db13f531a8a56e69c74d8	6	24.37914615	88.62372721
00000001000000227	Shahnaz Jahan	01945706220	rafiq@outlook.com	NORMAL	fp_f65e6f9b71c0ed23c383d0d6175de525	7	24.85815958	89.38042558
00000001000000228	Khadija Rahman	01142900481	hasanchowdhury@yahoo.com	NORMAL	fp_c7608a8e0e982e7e70a6ded388ef04b4	8	22.81244121	89.57389656
00000001000000229	Saleha Begum	01193647974	hasanchowdhury@outlook.com	NORMAL	fp_96f962771fe5c79194bd95594ad14f94	9	23.16221298	89.20306961
00000001000000230	Md. Morshed	01237155734	karimislam@hotmail.com	NORMAL	fp_b696a07936d8fa473925af15f41849b8	10	24.88508997	91.84972416
00000001000000231	Syed Khan	01871775659	khadija@gmail.com	NORMAL	fp_0eac06872c9f92ace2019740cd457ac4	1	23.85878291	90.36911289
00000001000000232	Syed Ahmed	01607249903	kamal23@yahoo.com	NORMAL	fp_1a36c2bece842235140aed1d06a6460b	2	23.78713066	90.38171311
00000001000000233	Md. Shahidul	01886405935	rafiqchowdhury@hotmail.com	NORMAL	fp_317d3e1224c25cc9234db479f3879ee0	3	24.01232511	90.43924069
00000001000000234	Shahid Mia	01624426485	fatema@hotmail.com	NORMAL	fp_34cd8fb9e913db590a34fbab8781c6f0	4	22.34225974	91.78128454
00000001000000235	Syed Mia	01844911809	kamal25@yahoo.com	NORMAL	fp_d1800c93393342705972b60edde7085e	5	22.34241973	91.85360974
00000001000000236	Shahriar Chowdhury	01105755161	khan@hotmail.com	NORMAL	fp_ffe89519f1f472f297a5f36274e5633e	6	24.35767955	88.59091562
00000001000000237	Muhammad Khan	01922679976	salammia@hotmail.com	NORMAL	fp_d9b6ecf38e8b77ac4999280411a12687	7	24.87314610	89.38075337
00000001000000238	Md. Shahed	01961106654	salam84@outlook.com	NORMAL	fp_f91add7adceb6e57ebebb361916fe34e	8	22.81462364	89.54514999
00000001000000239	Saleha Begum	01735729714	sarker@yahoo.com	NORMAL	fp_43fa65086ca9f27979c77d9f406f4839	9	23.17548991	89.21880911
00000001000000240	Quazi Islam	01411234373	salam@outlook.com	NORMAL	fp_8c10b10d534e0993ceb4f70ee15d1458	10	24.88313462	91.87015466
00000001000000241	Muhammad Chowdhury	01723530031	shahin41@outlook.com	NORMAL	fp_0a07d2a011917c32704b5faf97d51140	1	23.86166053	90.38046357
00000001000000242	Shirin Begum	01956644015	nargis@outlook.com	NORMAL	fp_2815a9fe1a2910e43beff028b5da76b4	2	23.76186392	90.37498733
00000001000000243	Md. Karim	01499270986	shahinkhan@gmail.com	NORMAL	fp_9a8745c013f6eb3d6fe56677cc0fa421	3	24.01461994	90.43670536
00000001000000244	Chowdhury Khan	01981292143	shirin@yahoo.com	NORMAL	fp_8768b8f17f880001de45c9c2ef27bb2f	4	22.34048699	91.79717731
00000001000000245	Md. Nurul	01242658245	shahin@outlook.com	NORMAL	fp_2cedc535e1529a6514f8e03d6771acc6	5	22.31025699	91.82914947
00000001000000246	Shahida Begum	01580973399	ayesha@hotmail.com	NORMAL	fp_f96460d5afd9be585c9b497c0621537f	6	24.37125477	88.61656215
00000001000000247	Md. Hasan	01296277479	khan@yahoo.com	NORMAL	fp_bd2e05b64fa6f617a2ba5414737b51df	7	24.82620418	89.38123185
00000001000000248	Marium Akter	01359810338	parvin@gmail.com	NORMAL	fp_85277d1f3dff71901c64dc73a9088c53	8	22.81007983	89.57967391
00000001000000249	Md. Shahed	01993204887	rabeya@yahoo.com	NORMAL	fp_50441831637b47ef7cb88703e9d3d9d8	9	23.16532879	89.20647630
00000001000000250	Shahida Sultana	01158636359	kamal60@yahoo.com	NORMAL	fp_32a749464bcca1880f4b9540fc5a53f6	10	24.88786258	91.89183003
00000001000000251	Shahjahan Mia	01166509560	shahinkhan@outlook.com	NORMAL	fp_2b0326d3bbeaa43894475109bf47c166	1	23.86057863	90.37743564
00000001000000252	Saleha Sultana	01814220872	khadija@gmail.com	NORMAL	fp_367426342806c1261e0f905ce196c3ac	2	23.80496393	90.40117900
00000001000000253	Syed Das	01738789816	parvin@outlook.com	NORMAL	fp_574b3074bbf7d1547920b984df57585f	3	23.98943169	90.43511097
00000001000000254	Nasrin Khan	01462561932	rafiq38@hotmail.com	NORMAL	fp_aa1e9ff1c0b0386e00fb33b038b7e396	4	22.36031376	91.77362592
00000001000000255	Nasrin Jahan	01641716005	shahin@yahoo.com	NORMAL	fp_f8a2b285879eccebde806a27b8f1697b	5	22.34520168	91.82930389
00000001000000256	Quazi Sarker	01486747567	shofiqsarker@outlook.com	NORMAL	fp_f0a451d437cc6a80519cbe4de200188c	6	24.37045035	88.62876753
00000001000000257	Lima Sultana	01583725777	kamal99@yahoo.com	NORMAL	fp_b0e164cd65267078c1222c499a06360d	7	24.86030252	89.37836027
00000001000000258	Shirin Chowdhury	01335269240	salam@gmail.com	NORMAL	fp_e88bd30c7db2cc440c103b8fcdbf6ba5	8	22.79369943	89.56456897
00000001000000259	Nasrin Khatun	01724674618	salam16@hotmail.com	NORMAL	fp_1e9178c68e5f7745223a91fbbba26189	9	23.15866292	89.21520823
00000001000000260	Shima Khan	01707396934	jamalali@bdmail.net	NORMAL	fp_37362c59885c77119a838d7dc7c7239a	10	24.88304614	91.85276886
00000001000000261	Shahnaz Hossain	01194267827	ayesha@outlook.com	NORMAL	fp_e29835379850bf7d6bf0382178142b28	1	23.89611619	90.36160370
00000001000000262	Nargis Begum	01566435384	hasanmia@outlook.com	NORMAL	fp_f7e45d45f66cfa97af5032134c0d0cc3	2	23.77342437	90.38795281
00000001000000263	Morjina Jahan	01921387275	hossain@bdmail.net	NORMAL	fp_607b0a3610f8aaf586542e789c9d5cce	3	23.99987601	90.40874209
00000001000000264	Golam Islam	01620564672	rahimhossain@hotmail.com	NORMAL	fp_12cc5b7ce0e028cd7b66df88ac6e67eb	4	22.38108402	91.76433262
00000001000000265	Nipa Hossain	01988784289	ayesha@outlook.com	NORMAL	fp_dae280ef7ceccc31519996374db5b767	5	22.33915596	91.81754649
00000001000000266	Gias Khan	01867763205	shirin@yahoo.com	NORMAL	fp_e5fdc985221073fb99c8b5a2fce10bbf	6	24.35249653	88.62001793
00000001000000267	Md. Mostafa	01238611733	rahman@outlook.com	NORMAL	fp_52bf51e2d5a4329b43e877aca7d85c8f	7	24.86634682	89.38352128
00000001000000268	Ayesha Begum	01508305806	jamal@outlook.com	NORMAL	fp_b35fe4c997102a6de8ba2a0ea639508a	8	22.81029310	89.55011127
00000001000000269	Nargis Begum	01938632894	shahinislam@hotmail.com	NORMAL	fp_029ff7a74ea8c3b6856aaa281125f3c8	9	23.18151621	89.22431543
00000001000000270	Shahida Islam	01558139587	kamalkhan@outlook.com	NORMAL	fp_b7c2e160b1b9fb0db0b43cd460b0e7f9	10	24.88847895	91.84797062
00000001000000271	Tania Khatun	01886840555	nargis@outlook.com	NORMAL	fp_ef0dc93712e963e6ed60a3b114d8c1fe	1	23.86094190	90.39435486
00000001000000272	Farida Khatun	01933615017	shahindas@yahoo.com	NORMAL	fp_b384e8a075c10ef890969af33397d69c	2	23.78214975	90.39322517
00000001000000273	Shahrukh Islam	01543505920	kamal44@outlook.com	NORMAL	fp_8228edb91c5888027d25542ae55824b6	3	24.02180329	90.42292677
00000001000000274	Shah Ali	01618468217	hossain@outlook.com	NORMAL	fp_ea4d97bda2c3e67e26209893421cbc4d	4	22.38088144	91.77510688
00000001000000275	Sultan Islam	01453901363	karim@outlook.com	NORMAL	fp_30f49566f90228d0cae0194b275093f4	5	22.33237566	91.82755169
00000001000000276	Nipa Jahan	01155282861	rahman@outlook.com	NORMAL	fp_9aa4a7cb243d1b9722fb9190f1a10e59	6	24.36874796	88.58763749
00000001000000277	Rina Begum	01293799132	nasrin@hotmail.com	NORMAL	fp_3c5cefcbff4d5004a8de84cb88be8313	7	24.84952318	89.36699921
00000001000000278	Rabeya Begum	01999165986	hasanmia@yahoo.com	NORMAL	fp_8bc52c8cfa50d34fc6fbeb580d5f06ab	8	22.83968494	89.56951325
00000001000000279	Chowdhury Sarker	01997180760	nasrin@hotmail.com	NORMAL	fp_e28fb97d4c5092d5355bd0dc837500bc	9	23.15874974	89.19967179
00000001000000280	Shahjahan Sarker	01426793722	shofiq29@outlook.com	NORMAL	fp_11f068e7b36c56949e6ecb6495b8b504	10	24.90597636	91.86356873
00000001000000281	Halima Hossain	01402209948	fatema@yahoo.com	NORMAL	fp_5c811c19786a435b9d8e74d301858e75	1	23.87862621	90.36433147
00000001000000282	Shahid Sarker	01506798676	salam77@yahoo.com	NORMAL	fp_da39875f4ca8c7ab67c690bb21c2dd14	2	23.78193089	90.37676404
00000001000000283	Gias Islam	01236330536	sarker@gmail.com	NORMAL	fp_4c1a617e3ab037fa839b4d69c6b525c6	3	23.97947665	90.41269176
00000001000000284	Nargis Hossain	01677251743	das@yahoo.com	NORMAL	fp_c9783d327d197b89337a5fc35709f127	4	22.36002999	91.78592400
00000001000000285	Shah Sarker	01211104736	hossain@bdmail.net	NORMAL	fp_14716674f2da6639214c2d96e4f9d422	5	22.33321626	91.83930130
00000001000000286	Shirin Islam	01936617148	salamsarker@gmail.com	NORMAL	fp_1d9837af36a1756fe8f736a967aa1a9a	6	24.39914694	88.59330769
00000001000000287	Md. Morshed	01871435950	hasan44@bdmail.net	NORMAL	fp_72e3eaa65a6fed9b1dcdcf33f4d9c8b6	7	24.85550793	89.34858359
00000001000000288	Nasrin Mia	01691929538	shofiq53@yahoo.com	NORMAL	fp_dfe032c7825ae766375b5e5908b55ef3	8	22.83385137	89.56785343
00000001000000289	Nazma Islam	01184843305	rahimchowdhury@gmail.com	NORMAL	fp_f96352a8e0500fa082bb5efd58881942	9	23.19092349	89.21729366
00000001000000290	Shahadat Rahman	01295237878	shofiq75@yahoo.com	NORMAL	fp_725db8dea3e9e5e6dd77af0b158803e2	10	24.87299927	91.88561437
00000001000000291	Sheikh Haque	01754687600	shirin@hotmail.com	NORMAL	fp_6dd325cd5a45335a144bd09b4a76a0b1	1	23.86953825	90.39725273
00000001000000292	Sultan Ahmed	01782816035	karimchowdhury@hotmail.com	NORMAL	fp_1bbca32e4de6570c37ea5589098e769d	2	23.78271801	90.38605090
00000001000000293	Shahnewaz Ali	01494201673	das@yahoo.com	NORMAL	fp_8d7ebbeadaaa16678d48a554f98be4b2	3	24.00534788	90.41912788
00000001000000294	Abdur Das	01333993357	fatema@hotmail.com	NORMAL	fp_1828c71fd6b50a2a8a43b5091045f846	4	22.34035304	91.79108578
00000001000000295	Md. Kamal	01633994922	shahana@bdmail.net	NORMAL	fp_b35b34208c4992e008ff34fa7189e78f	5	22.32849295	91.82154608
00000001000000296	Nargis Begum	01898980304	rafiq72@gmail.com	NORMAL	fp_bbd34557d80fa4df6bd71f9c0579bf46	6	24.36889640	88.62107540
00000001000000297	Mir Sarker	01435214744	salam@gmail.com	NORMAL	fp_10e847aa01954e5f425a3c5d5707340d	7	24.83098331	89.35248463
00000001000000298	Syed Mia	01282038549	hasan90@gmail.com	NORMAL	fp_4290117f33a25e6bf6a87dd16b82df2a	8	22.82365145	89.58035934
00000001000000299	Shamsul Hossain	01423173571	mia@hotmail.com	NORMAL	fp_2fa6f06d2069da6220ef726b8d6b530d	9	23.17578857	89.19798117
00000001000000300	Halima Khatun	01538372284	shahin14@yahoo.com	NORMAL	fp_0da99d442e549926a849c0c3fd347394	10	24.88206260	91.89276003
00000001000000301	Khadija Rahman	01428374804	shofiq@hotmail.com	NORMAL	fp_ce2e49adb294c4b474764ec1e751cf32	1	23.88040099	90.39637422
00000001000000302	Parvin Begum	01654033210	rafiqislam@gmail.com	NORMAL	fp_39befbf8afcbc0f5c9d90474634979df	2	23.79696248	90.37845849
00000001000000303	Rokeya Begum	01751864403	rafiq3@yahoo.com	NORMAL	fp_482a8429009c9867761c87f3ca4ec014	3	23.97689663	90.44019524
00000001000000304	Rina Khatun	01766904574	shahana@outlook.com	NORMAL	fp_787572ae5f9ae23e98dbb70cd4aac785	4	22.37816945	91.77122470
00000001000000305	Shahana Rahman	01933210954	sarker@outlook.com	NORMAL	fp_430ece5aa9760c7d4152a6258e5d666d	5	22.33690266	91.81856916
00000001000000306	Shahin Ahmed	01547101206	parvin@gmail.com	NORMAL	fp_a2b42b9dbb676b4ee24d47ab8871a99a	6	24.37371901	88.61306722
00000001000000307	Sultan Mia	01982227636	rahimrahman@yahoo.com	NORMAL	fp_2bd20b3abdbbf94df3565ac3cdd797f4	7	24.85630236	89.34994027
00000001000000308	Shahida Rahman	01564970567	nasrin@hotmail.com	NORMAL	fp_3382ba50df6ce33efb62b6fe304a9a8c	8	22.83888820	89.56131742
00000001000000309	Abul Ahmed	01643064848	jamalsarker@yahoo.com	NORMAL	fp_4d93ca26f40ba34844ee2a847b26d94c	9	23.16022979	89.22463572
00000001000000310	Syed Ali	01571997375	hasanali@hotmail.com	NORMAL	fp_9647e1905742cb928517fac983cb9c88	10	24.88843081	91.88103832
00000001000000311	Mina Khatun	01763262340	khan@outlook.com	NORMAL	fp_0c9fa851b93d25436a7ed3d86705e4d5	1	23.87281421	90.36715810
00000001000000312	Golam Ahmed	01490646195	shahindas@hotmail.com	NORMAL	fp_c49394b911d827290204dd54f904801c	2	23.76727698	90.37189144
00000001000000313	Ms. Chowdhury	01116254482	salamislam@hotmail.com	NORMAL	fp_865a5f54f311e7d8394722c725d9b3bf	3	23.99216519	90.40247045
00000001000000314	Marium Akter	01975866697	kamal@outlook.com	NORMAL	fp_560d023a0495fd98c7307141dda21560	4	22.35561261	91.80300363
00000001000000315	Md. Shahin	01938536568	karimahmed@gmail.com	NORMAL	fp_3b08ffbc3f98a5bb2635d30dbdf3fd0a	5	22.35551443	91.82443639
00000001000000316	Parvin Jahan	01476246677	rafiqahmed@hotmail.com	NORMAL	fp_b5c0e84c35c3b143b189ff563594c374	6	24.39877874	88.61927274
00000001000000317	Mir Hossain	01636952231	rahim@hotmail.com	NORMAL	fp_5b1a52f621054baf268e585c88f9f8f4	7	24.86653095	89.35250296
00000001000000318	Rabeya Begum	01139574950	shofiqkhan@gmail.com	NORMAL	fp_decee667d92822e315c86b19b276226c	8	22.80504138	89.55525285
00000001000000319	Farida Sultana	01168337799	islam@outlook.com	NORMAL	fp_a5b246c06a79a3773e6733bc9c12e426	9	23.16820230	89.18877435
00000001000000320	Mohammad Islam	01320563990	shahindas@hotmail.com	NORMAL	fp_1cf1698643bea38ece303724dac9fd0f	10	24.90431501	91.88773822
00000001000000321	Khadija Akter	01434227775	salamhossain@hotmail.com	NORMAL	fp_39d8b9362c95411414c0f2943821d6e6	1	23.87754582	90.38776644
00000001000000322	Shahrukh Khan	01385729863	ahmed@outlook.com	NORMAL	fp_df5108b476ab64528f7f7285dc46faee	2	23.78684942	90.36394742
00000001000000323	Nargis Begum	01687629721	chowdhury@yahoo.com	NORMAL	fp_7c648548a497e3fe3666141946ffc649	3	24.00172274	90.41902987
00000001000000324	Nazma Begum	01733691246	shofiq@outlook.com	NORMAL	fp_562cfa7ede402b738d4f70d0936d618c	4	22.37061769	91.76663498
00000001000000325	Abul Sarker	01201110831	kamal34@hotmail.com	NORMAL	fp_a21b2b44ae8f2400fec4df6642ac0192	5	22.33558331	91.84823245
00000001000000326	Chowdhury Mia	01590604620	shahinmia@yahoo.com	NORMAL	fp_687084f3010dc5098f97b9a2606b6161	6	24.38071011	88.60420084
00000001000000327	Nasima Das	01250105337	rafiq@outlook.com	NORMAL	fp_fa51a02686e51c7f3619a5a46eaff74d	7	24.84798822	89.39317027
00000001000000328	Ripa Khan	01858002898	shofiq36@outlook.com	NORMAL	fp_cdc3e39b8f048ff497cc5dd51fddd278	8	22.81610948	89.57552640
00000001000000329	Golam Sarker	01679193836	hossain@yahoo.com	NORMAL	fp_5521f19fde87cac8902f954a53cc2928	9	23.17965580	89.18483105
00000001000000330	Shirin Begum	01939592023	hossain@yahoo.com	NORMAL	fp_f6acb2ae2e0589c39fe47d0093fe4da7	10	24.90270745	91.85436407
00000001000000331	Md. Morshed	01216022437	chowdhury@gmail.com	NORMAL	fp_bb5a8b37786bb7b50fabe0c1c2c55c4b	1	23.85988701	90.38456192
00000001000000332	Ripa Begum	01163647121	salamkhan@hotmail.com	NORMAL	fp_56a848da8be938994b625bd15b5c05ab	2	23.79081736	90.39840118
00000001000000333	Nargis Begum	01302738843	das@bdmail.net	NORMAL	fp_2fd80ab7b73256e7ae563ff0a93137e2	3	24.02404746	90.42855431
00000001000000334	Shah Chowdhury	01112341804	shahana@outlook.com	NORMAL	fp_c3be14dd8818757ff971084499759fd4	4	22.37192245	91.78833262
00000001000000335	Syed Ahmed	01587457599	rafiq12@bdmail.net	NORMAL	fp_698d3ababebf9d36482c54f33d80a947	5	22.31468389	91.80898623
00000001000000336	Ruma Mia	01183928305	hasan37@yahoo.com	NORMAL	fp_3b176b322f3be7bf9aae6521164f5a91	6	24.37348300	88.60485680
00000001000000337	Tania Khan	01720765245	hasan@hotmail.com	NORMAL	fp_60276ed02cdbbbf67f40a55133b3e505	7	24.84949352	89.37499235
00000001000000338	Abul Sarker	01892719630	shahinislam@outlook.com	NORMAL	fp_13c4bb03fd19937ff58a9b09bd1ff2b5	8	22.82318505	89.55051874
00000001000000339	Shirin Khatun	01916270685	mia@outlook.com	NORMAL	fp_036c3b6eab3c1cf91ae0dcdc4cbb4494	9	23.14505586	89.21207724
00000001000000340	Tania Chowdhury	01385993632	shahana@yahoo.com	NORMAL	fp_7df0dd11af06f74aea5c3813ed5c4db6	10	24.87020023	91.84793694
00000001000000341	Parvin Begum	01681243368	mia@gmail.com	NORMAL	fp_83743ad17e5992b4864a802f675a2e19	1	23.87342399	90.36330633
00000001000000342	Syed Mia	01451200149	hasanchowdhury@bdmail.net	NORMAL	fp_432b75ba8a4a7306f0e34b2cfd1ca985	2	23.78491975	90.36809874
00000001000000343	Abul Hossain	01659043399	fatema@yahoo.com	NORMAL	fp_4b209a6e4b81cf243a05026071b5ba12	3	23.98082785	90.42894597
00000001000000344	Mst. Khan	01843644798	ahmed@outlook.com	NORMAL	fp_aa825c4e19849286d0320ab450bab95d	4	22.34917976	91.77519689
00000001000000345	Shahadat Rahman	01505139747	shirin@outlook.com	NORMAL	fp_4a42095a63a7dd7fc21d6a2664b6db31	5	22.34891608	91.81570084
00000001000000346	Nasrin Islam	01464410572	rahman@outlook.com	NORMAL	fp_74d893d52dde571807860a707072f8b8	6	24.37057751	88.60351385
00000001000000347	Khadija Rahman	01923478974	shahana@gmail.com	NORMAL	fp_9c373ec326342c93282fff0bf2414b87	7	24.83753469	89.38046732
00000001000000348	Md. Morshed	01750325781	sarker@bdmail.net	NORMAL	fp_f13a2b3fb8326df14261a04044310f88	8	22.81966176	89.57419308
00000001000000349	Md. Jabbar	01258882016	karimmia@yahoo.com	NORMAL	fp_83203474811f8d5b7025b2b67e353b3f	9	23.18120322	89.19926999
00000001000000350	Rabeya Akter	01892932799	rahman@outlook.com	NORMAL	fp_9134d09ae3ec84559083e95e05664d76	10	24.91366987	91.85386242
00000001000000351	Md. Nurul	01799424073	barkatali@outlook.com	NORMAL	fp_a40e014d24a14fa038197288300bf632	1	23.89184974	90.35495890
00000001000000352	Ripa Khan	01308924691	shofiqahmed@outlook.com	NORMAL	fp_87fa406f756d7bf1deb130a58ed3a6f4	2	23.79443623	90.37549213
00000001000000353	Halima Hossain	01259518185	mia@yahoo.com	NORMAL	fp_7a39f4af6e218056b60ae7647d12531b	3	23.99486946	90.42616951
00000001000000354	Fatema Begum	01104009996	kamaldas@outlook.com	NORMAL	fp_03f8b352595a0111cfdcc85cc4e233d8	4	22.35255076	91.76721510
00000001000000355	Shahid Ali	01673413191	rahimkhan@yahoo.com	NORMAL	fp_006e75c65474267f3897d7d334395d5d	5	22.31275784	91.82685416
00000001000000356	Shirin Hossain	01270004913	mia@hotmail.com	NORMAL	fp_0e7a7ee545fee0f5082bf42e4b176b0a	6	24.38588542	88.59035813
00000001000000357	Mohammad Hossain	01798541427	hasan@outlook.com	NORMAL	fp_afccab38ebdc794007e8766cc4d71064	7	24.84382429	89.39226501
00000001000000358	Md. Kamal	01573970171	kamal76@outlook.com	NORMAL	fp_4cb47449da25e71736ab4e4494e09f4e	8	22.79550119	89.54075898
00000001000000359	Shah Mia	01263161931	karim@outlook.com	NORMAL	fp_790658656949c6fd0caef00546a9ba44	9	23.18179307	89.22071210
00000001000000360	Shah Islam	01449227078	mia@yahoo.com	NORMAL	fp_54b4100d2122bff2a9894eb29b022042	10	24.91241630	91.85517684
00000001000000361	Shahinur Sultana	01463875992	hasan71@hotmail.com	NORMAL	fp_aae9afe2bde7165ca0f377720c498807	1	23.87948866	90.39627396
00000001000000362	Sheikh Khan	01174027447	hasanmia@yahoo.com	NORMAL	fp_86d0b09fe92322cd72c9b410f8837d1b	2	23.80461689	90.39531077
00000001000000363	Md. Salam	01179120188	sarker@outlook.com	NORMAL	fp_7d3555b0136fab62cad5d0a6c9c5b466	3	24.01433828	90.39861061
00000001000000364	Ruma Hossain	01188073644	shirin@bdmail.net	NORMAL	fp_ca991d3f4372777ba0cb6fdc15423438	4	22.37951637	91.77102749
00000001000000365	Md. Morshed	01997755071	parvin@gmail.com	NORMAL	fp_2710ad6b8a18a9a4e540e8356e629f0c	5	22.31583192	91.84929380
00000001000000366	Ruma Begum	01572813969	ayesha@outlook.com	NORMAL	fp_8a4cd672e18753dbe22b5e49b658aa55	6	24.35045510	88.62034792
00000001000000367	Saleha Rahman	01616080953	karimahmed@bdmail.net	NORMAL	fp_2882e939361b379b87a671d48d76bf4c	7	24.84028260	89.39302672
00000001000000368	Mina Rahman	01677613058	khadija@outlook.com	NORMAL	fp_b4a3de49300027ab6054ae11e9b21df6	8	22.83396916	89.54444556
00000001000000369	Ruma Khan	01748020154	rahimmia@bdmail.net	NORMAL	fp_cd64498f03b5571c25f44d3db2801d76	9	23.17402350	89.18278097
00000001000000370	Md. Rafique	01704076749	sarker@gmail.com	NORMAL	fp_3ace5329b8e4c23a4c74e6d502725685	10	24.90389378	91.85678176
00000001000000371	Abu Islam	01873703562	kamalkhan@outlook.com	NORMAL	fp_1cc1baa0f359294c22f87a524bc49f91	1	23.86807515	90.38448472
00000001000000372	Chowdhury Sarker	01581945037	rafiqmia@outlook.com	NORMAL	fp_e2fe0cf6fc06812bdba9b85b2aeb41c3	2	23.80377755	90.36124348
00000001000000373	Syed Sarker	01762671138	shofiqsarker@outlook.com	NORMAL	fp_10b00495ecdedb950f35c7eb8e0ea8e9	3	23.97578683	90.41222914
00000001000000374	Shamima Sultana	01780709222	shahana@outlook.com	NORMAL	fp_52cd0ddc484c3598b99f0e10e807dfc9	4	22.33247179	91.77485117
00000001000000375	Shahana Begum	01101638093	ayesha@outlook.com	NORMAL	fp_0136d29a0dfc1363bcffc69f918fdc18	5	22.31544749	91.84662820
00000001000000376	Nasrin Khan	01543047235	islam@outlook.com	NORMAL	fp_df3385ba213ada77184e83219c996151	6	24.36209526	88.58433846
00000001000000377	Muhammad Mia	01284541310	nargis@hotmail.com	NORMAL	fp_c9911d7726289c120cfbf8f4c435898b	7	24.85643624	89.35432078
00000001000000378	Shah Ali	01190517105	hossain@hotmail.com	NORMAL	fp_2c81e8796bed3b68eec4ed8b8a8a5c96	8	22.82553510	89.57030697
00000001000000379	Parvin Begum	01376428012	shahin@outlook.com	NORMAL	fp_327d8cb1b4120b18d554266560d571c2	9	23.16776812	89.18421412
00000001000000380	Abdul Islam	01983688679	ayesha@bdmail.net	NORMAL	fp_5db79e2e60404f3471a12a0884b653a2	10	24.90525752	91.88232734
00000001000000381	Nur Ahmed	01309208467	nargis@gmail.com	NORMAL	fp_ed51c96b6d2a38c6f46843b23fb4536b	1	23.87900691	90.38679628
00000001000000382	Abul Islam	01879900724	nargis@hotmail.com	NORMAL	fp_28454b072c9b9dc3a7dd5959a1fe7a92	2	23.76746256	90.36515118
00000001000000383	Shahinur Hossain	01137690668	shahinislam@gmail.com	NORMAL	fp_8ee9cce2fdfb0fef94ce6723f80fc61c	3	24.01055209	90.44017428
00000001000000384	Shahjahan Khan	01644374981	nargis@yahoo.com	NORMAL	fp_e65b25130df760db9f42ec063103c3e8	4	22.37712206	91.77907435
00000001000000385	Tania Rahman	01870035696	nasrin@yahoo.com	NORMAL	fp_99356568ecd2e1b46e84a6c8f565747b	5	22.32011832	91.85549544
00000001000000386	Md. Jabbar	01859151384	salam5@yahoo.com	NORMAL	fp_704cc24265f08b6f75bf028bc84caaef	6	24.37021806	88.58169505
00000001000000387	Shah Rahman	01896381547	ayesha@hotmail.com	NORMAL	fp_3c3529f24c8ed3ad40452191ad146925	7	24.85550804	89.39469122
00000001000000388	Md. Kamal	01116431533	sarker@hotmail.com	NORMAL	fp_0477d53c4a9bfc98efb8a8799888ce35	8	22.82330805	89.53553987
00000001000000389	Nasima Das	01549761811	das@hotmail.com	NORMAL	fp_db249d9ad2ab0e45a270515d47362984	9	23.19052569	89.19780769
00000001000000390	Nasrin Islam	01599905076	shirin@yahoo.com	NORMAL	fp_dfd2aa6481c23c89eed9ae842d52e671	10	24.91341705	91.87443010
00000001000000391	Md. Jabbar	01749032765	salam78@yahoo.com	NORMAL	fp_0c3ab08f214091d458509407ebca8cc0	1	23.90053032	90.36563028
00000001000000392	Ms. Islam	01383854653	chowdhury@yahoo.com	NORMAL	fp_e4ff5a4673254e8af11ef11f1cd7ca17	2	23.78655362	90.37691092
00000001000000393	Shahnewaz Khan	01348832647	parvin@bdmail.net	NORMAL	fp_ef2944d5fb1f6b40ebbc82c562fafd56	3	23.99573059	90.39598322
00000001000000394	Muhammad Ali	01243933179	rahimmia@yahoo.com	NORMAL	fp_52812c657bb69e7b2f46712c76f7e5ed	4	22.33506226	91.76710430
00000001000000395	Nasima Sultana	01624000966	nasrin@outlook.com	NORMAL	fp_3c21ca02559c56dbed09319d3a202dc4	5	22.31331956	91.83337514
00000001000000396	Shirin Begum	01870787491	nasrin@hotmail.com	NORMAL	fp_faae60f10c6a8a2b9a622875b44f1d2c	6	24.37215941	88.59778024
00000001000000397	Shahriar Islam	01703605732	karim@bdmail.net	NORMAL	fp_511227acde78ccca6bbec6ee3f87aa3b	7	24.87287533	89.36239235
00000001000000398	Shirin Chowdhury	01777796410	islam@hotmail.com	NORMAL	fp_46afdca89afbefd5396fe411ed1c4bd1	8	22.82741074	89.55807272
00000001000000399	Nur Ali	01340870545	khadija@bdmail.net	NORMAL	fp_6bb4b9a8fcd7967768a56317b5fd99f8	9	23.14749180	89.22525519
00000001000000400	Shahnewaz Mia	01156743095	rafiqchowdhury@outlook.com	NORMAL	fp_b90391004e2bf1044098c477711ebc33	10	24.90615030	91.85207492
00000001000000401	Md. Morshed	01715721467	khan@yahoo.com	NORMAL	fp_82f1d0ffdcd8baf3ec477adcd2a7add4	1	23.89658934	90.38031244
00000001000000402	Shahriar Hossain	01154332600	hasan8@yahoo.com	NORMAL	fp_2da2c111fe9993db92e2ab6f147821ce	2	23.79480662	90.35961291
00000001000000403	Syed Chowdhury	01442591958	shirin@outlook.com	NORMAL	fp_91f272325cadf0c3bfd6d028209fcf6d	3	24.01163106	90.42390155
00000001000000404	Shirin Hossain	01790912746	khadija@hotmail.com	NORMAL	fp_13719b15fa6ae34a541bde61fd07990d	4	22.38084295	91.77571477
00000001000000405	Shahnewaz Rahman	01967674363	jamal34@gmail.com	NORMAL	fp_66622009c7aabf412f74477ce0adb6b9	5	22.32258817	91.81913279
00000001000000406	Rokeya Begum	01823927092	shofiq@outlook.com	NORMAL	fp_5f4b48cc5627a7009e29260ffaedb3fb	6	24.39010180	88.62349053
00000001000000407	Nasrin Begum	01487251092	das@hotmail.com	NORMAL	fp_41d31440c01c65a82e86330116f8d05e	7	24.86703139	89.35747698
00000001000000408	Mir Sarker	01426396795	shofiq70@gmail.com	NORMAL	fp_175adb5cc059591a3bea972aa15d9462	8	22.82559081	89.56476563
00000001000000409	Tania Akter	01366979610	rafiqhossain@outlook.com	NORMAL	fp_d1c039149ad77e2750ab8c13ad6aee8d	9	23.16695563	89.21587954
00000001000000410	Md. Jabbar	01939363013	parvin@yahoo.com	NORMAL	fp_5f8d715a5cc7e90f76f4d7e62386637b	10	24.88558616	91.85733141
00000001000000411	Abdur Mia	01494602904	kamalchowdhury@yahoo.com	NORMAL	fp_ba46bff0bc39c1779dd7cfce07c3acc2	1	23.87239131	90.36381857
00000001000000412	Shah Ali	01309114827	kamalmia@hotmail.com	NORMAL	fp_aaa35cd455a1e0f9b86a4348a7c240c5	2	23.78276699	90.38374374
00000001000000413	Shamsul Khan	01247005642	hasan@bdmail.net	NORMAL	fp_d9e970ae8b0f2b8015ef4a061a820d90	3	24.00311629	90.44031671
00000001000000414	Nasima Sultana	01341516039	kamal@bdmail.net	NORMAL	fp_8ecfa452f4e1f5ada07dfd4cb0c8718e	4	22.37103429	91.78514796
00000001000000415	Shamsul Sarker	01820266999	kamaldas@bdmail.net	NORMAL	fp_c379bd813d0daac1873ca58cc0b00fcf	5	22.35481917	91.81429978
00000001000000416	Lutfur Khan	01183892917	shahin88@outlook.com	NORMAL	fp_3bf64fcab629fc90114b557629429bf3	6	24.37225112	88.59262218
00000001000000417	Nasrin Begum	01593824982	hasan76@bdmail.net	NORMAL	fp_e6f61df6e9eb3309ce2308263d0ea127	7	24.82693941	89.36715398
00000001000000418	Shah Khan	01420779864	hossain@gmail.com	NORMAL	fp_a4a2a9b9d18c52821bcfdd5d0d3fe86b	8	22.83374266	89.54765562
00000001000000419	Shahana Hossain	01908382526	shirin@yahoo.com	NORMAL	fp_684f442e2b0f6a5a5163d9a0a0501083	9	23.16623444	89.20511937
00000001000000420	Mohammad Khan	01774437726	ayesha@hotmail.com	NORMAL	fp_515a968b9f9636c22da4f4f042844022	10	24.91032879	91.86207526
00000001000000421	Nur Sarker	01180170287	parvin@hotmail.com	NORMAL	fp_c550dec993c9a14197eb200fe38b0131	1	23.88421964	90.38280414
00000001000000422	Morjina Hossain	01429864699	hossain@yahoo.com	NORMAL	fp_805e39df030a2e8ad440b1a1281fb9a4	2	23.79544122	90.36462647
00000001000000423	Rabeya Islam	01657034725	nasrin@yahoo.com	NORMAL	fp_c3e03f70bfbf48f5facd08841d3c1c72	3	24.00973150	90.43389697
00000001000000424	Shila Hossain	01867346953	kamalali@outlook.com	NORMAL	fp_14fbcb53ea14e53560e79468c6cb157f	4	22.35836829	91.77394590
00000001000000425	Abdur Ahmed	01341573256	shirin@gmail.com	NORMAL	fp_c97e98914c26413cfc47efa5ae100645	5	22.35012768	91.85549453
00000001000000426	Shirin Rahman	01686924478	shirin@outlook.com	NORMAL	fp_f11707bf7de416c67d862a1ce913b5f0	6	24.39198015	88.62631878
00000001000000427	Lima Akter	01977311069	fatema@yahoo.com	NORMAL	fp_716f209bff61d6ab2c370a766fc2b51d	7	24.85292725	89.35972401
00000001000000428	Quazi Ahmed	01504925643	chowdhury@outlook.com	NORMAL	fp_77a44f1fccd0a5b430a6090cf9e8d05d	8	22.80003859	89.58155722
00000001000000429	Shahjahan Ali	01253058665	karimdas@bdmail.net	NORMAL	fp_5a55add742e25496149da84a06b8dab2	9	23.16874670	89.20386176
00000001000000430	Md. Barkat	01539283649	khadija@hotmail.com	NORMAL	fp_89f76aad35890619f1fd2838491e2c30	10	24.87793368	91.87468689
00000001000000431	Chowdhury Haque	01107733673	rahim65@yahoo.com	NORMAL	fp_8b11484a34fbcbbc24da1016884af706	1	23.85196830	90.37539886
00000001000000432	Mrs. Islam	01265311385	shahin@bdmail.net	NORMAL	fp_80ad90a5f4a93e40fb80bf3df4a2c93a	2	23.76230805	90.37423143
00000001000000433	Halima Begum	01693943508	jamal1@hotmail.com	NORMAL	fp_4337faab098b8826ff0929ae071727d9	3	23.97682092	90.43704348
00000001000000434	Jahanara Begum	01429796492	shirin@outlook.com	NORMAL	fp_7890ae04166c70fc5420044df4c37111	4	22.35178159	91.80108496
00000001000000435	Syed Haque	01942804195	shahinhossain@hotmail.com	NORMAL	fp_c883d8b87610e48a5bc167ef4bdeff89	5	22.31304405	91.84147637
00000001000000436	Shamima Islam	01879155391	kamal@gmail.com	NORMAL	fp_66e5ff19f232a759bfcef8069bd8c10b	6	24.37118983	88.62454572
00000001000000437	Gias Mia	01709243480	jamal@hotmail.com	NORMAL	fp_719d9935cee886cadfff6e5e35e2f2db	7	24.82681434	89.39520735
00000001000000438	Marium Rahman	01423580635	rahim89@hotmail.com	NORMAL	fp_98e4f4a87646b2ac1e12e6d6ffe08aa1	8	22.81710354	89.55577859
00000001000000439	Shahinur Chowdhury	01632881260	ali@gmail.com	NORMAL	fp_f9d77a9c8728806ab19c5462f0a7456a	9	23.18994394	89.22718266
00000001000000440	Md. Jabbar	01806142081	ayesha@outlook.com	NORMAL	fp_43912f7adc807fb864e14517fd98d9f1	10	24.89473876	91.87618890
00000001000000441	Rina Sultana	01453733836	mia@hotmail.com	NORMAL	fp_71178becb98358c154a891e24f2fa7a8	1	23.88990725	90.39622072
00000001000000442	Shahadat Chowdhury	01815467585	nargis@outlook.com	NORMAL	fp_c9e10ffdb17dbe163f568974a7154f38	2	23.77935511	90.38120359
00000001000000443	Farida Rahman	01651277331	fatema@hotmail.com	NORMAL	fp_7fbf36db55b0d737dfe46e4bc18830d7	3	24.00020255	90.39819849
00000001000000444	Rokeya Hossain	01989543494	sarker@bdmail.net	NORMAL	fp_ca7b623791ec6ec4b402c4913a9de97b	4	22.36414507	91.80525176
00000001000000445	Md. Jamal	01380596283	rokeya@yahoo.com	NORMAL	fp_8030b229b17dc2e885ea39066057722f	5	22.31213065	91.81708907
00000001000000446	Shamima Khatun	01258706577	sarker@outlook.com	NORMAL	fp_3bf1d218338554196e6c647acc3afdc2	6	24.38686170	88.59718084
00000001000000447	Shahnaz Hossain	01586318934	hossain@yahoo.com	NORMAL	fp_8ed53a535d143c09660d0b3dfb824202	7	24.83388063	89.39633909
00000001000000448	Md. Shahidul	01977305234	hasan@hotmail.com	NORMAL	fp_2ca10c891a3fb3fde3e3db66022c99a9	8	22.80181983	89.57576845
00000001000000449	Md. Mizanur	01439673739	chowdhury@outlook.com	NORMAL	fp_5bf461cc4f8eeb59d64368985a88e1fc	9	23.17601140	89.19329415
00000001000000450	Shirin Rahman	01150951560	rokeya@bdmail.net	NORMAL	fp_7f357ff7e3e4721f1fdef670f12fc08a	10	24.89404771	91.87359351
00000001000000451	Rabeya Chowdhury	01554185029	kamal@yahoo.com	NORMAL	fp_ccc75a772e8482418b7b1fa147a74c01	1	23.88121911	90.39826595
00000001000000452	Md. Rafiq	01408095146	karim@yahoo.com	NORMAL	fp_3912278a5a6b2010e15a96df1f7d17ab	2	23.78848609	90.38072749
00000001000000453	Saleha Begum	01989399613	jamalislam@gmail.com	NORMAL	fp_b6053d6b5b7fcccb1392640a854a9b22	3	24.00366401	90.41351973
00000001000000454	Md. Nurul	01827723023	salamrahman@bdmail.net	NORMAL	fp_79dba4c0a466d92bd4bea3c2f0fbf918	4	22.34884421	91.79779021
00000001000000455	Shila Islam	01277740152	rokeya@gmail.com	NORMAL	fp_bbf8936021c7a0bcc8ffbdfa5bdbce00	5	22.35719639	91.83231079
00000001000000456	Md. Barkat	01418622533	islam@bdmail.net	NORMAL	fp_adf9ce1386ab63dab7b27257c5ef0dfd	6	24.37680407	88.60566877
00000001000000457	Shahinur Begum	01475767457	shofiqhossain@bdmail.net	NORMAL	fp_e53fbf409e1fd677464c4e741ef44021	7	24.85855793	89.35782981
00000001000000458	Fatema Begum	01348397059	khan@yahoo.com	NORMAL	fp_2c6f59194156def25a600cf5715f0847	8	22.83185586	89.54816395
00000001000000459	Shahzad Ahmed	01185505721	shahinkhan@yahoo.com	NORMAL	fp_f7049bdcec316c25a19ce3317eb3c3a8	9	23.15118466	89.19225269
00000001000000460	Rabeya Akter	01127050910	das@gmail.com	NORMAL	fp_926cd10349a2ae4756d1181535c5b00a	10	24.88881690	91.87088972
00000001000000461	Ruma Khan	01379740943	karim10@yahoo.com	NORMAL	fp_15f275c8dfb8c90af8aa738f18c184fd	1	23.89222643	90.39457744
00000001000000462	Md. Shahed	01637424354	rahimdas@gmail.com	NORMAL	fp_f9c7559a012f468c0cac655aaa19ef20	2	23.79187425	90.38489793
00000001000000463	Parul Khatun	01805754556	shahin78@hotmail.com	NORMAL	fp_25cc299debfbde38f6268684a3152798	3	24.02128683	90.41520605
00000001000000464	Mohammad Rahman	01494389479	chowdhury@gmail.com	NORMAL	fp_a5b59dd13b1d8bda3c47a8087cb4caf9	4	22.34980413	91.78610960
00000001000000465	Shah Sarker	01962526015	karimdas@gmail.com	NORMAL	fp_505722f217f88fc850f4b8d637c52fe3	5	22.34889028	91.84913047
00000001000000466	Saleha Akter	01352165925	khadija@gmail.com	NORMAL	fp_25567c20afc593ea840e35668718bcfa	6	24.38262039	88.61470854
00000001000000467	Muhammad Mia	01468867070	jamal@outlook.com	NORMAL	fp_a9a9568338fee16d1b317033203c0690	7	24.86557127	89.34807579
00000001000000468	Abul Sarker	01888127259	hasanahmed@yahoo.com	NORMAL	fp_d2f603b7ecf9a9057ab3bed273deff0a	8	22.82194444	89.57397263
00000001000000469	Morjina Khan	01473882256	shahin@hotmail.com	NORMAL	fp_973ee402b125cb089db3b1c4ef3e000e	9	23.15746709	89.22170591
00000001000000470	Shahid Khan	01245612503	salam@hotmail.com	NORMAL	fp_780a829101f2cea192d456f0305ce268	10	24.87347297	91.86536213
00000001000000471	Shahana Akter	01772435672	rahimsarker@yahoo.com	NORMAL	fp_e359ea9e98b0f425ab7e4e4f844a3847	1	23.87169012	90.38947933
00000001000000472	Marium Hossain	01301046182	kamalhossain@bdmail.net	NORMAL	fp_dd50240dd2d1f0bd605705d0b2f8cc0f	2	23.79383624	90.36600853
00000001000000473	Shahadat Ahmed	01348226277	shahinmia@yahoo.com	NORMAL	fp_c0e80bcbd3c01e7c6a83b08c0114656f	3	23.98496807	90.43065246
00000001000000474	Shah Chowdhury	01846931798	rahim95@hotmail.com	NORMAL	fp_010278b7d8f1c6527cf52b1c2d8b2353	4	22.34876809	91.79293116
00000001000000475	Mrs. Rahman	01273911249	parvin@bdmail.net	NORMAL	fp_c950a5a8027b64ece2eb37d1b21df9d2	5	22.34475746	91.81535263
00000001000000476	Shirin Jahan	01221597430	chowdhury@hotmail.com	NORMAL	fp_b8ee8ca5ccc1b8a003661e204cb43ac6	6	24.35332841	88.61345552
00000001000000477	Shahrukh Mia	01842928640	nasrin@yahoo.com	NORMAL	fp_907b1ae111f03004dcb8825622ad83cf	7	24.86245920	89.38389134
00000001000000478	Nasrin Begum	01393181112	jamalislam@gmail.com	NORMAL	fp_2a8e499e849c8148b7ead89b5e9f2d01	8	22.81075430	89.56609605
00000001000000479	Fatema Begum	01855358794	mia@hotmail.com	NORMAL	fp_bca94073072f8bae25e84290cfdc13bb	9	23.18257435	89.20876608
00000001000000480	Lima Jahan	01246635812	islam@outlook.com	NORMAL	fp_059ac771c187c6cf5f246e1303bd4cb9	10	24.88379610	91.87609550
00000001000000481	Saleha Begum	01290298217	salamkhan@outlook.com	NORMAL	fp_e8e3382375bd7399e12f55da2f5726b3	1	23.86331616	90.38140438
00000001000000482	Shahnewaz Sarker	01445671729	karim18@hotmail.com	NORMAL	fp_30aaf346862c9434be76b85863eb2136	2	23.79258959	90.36998461
00000001000000483	Shahrukh Mia	01723443513	kamal@gmail.com	NORMAL	fp_a37a93fb66f27ab0d2b2c56438641c6f	3	23.98851382	90.39785053
00000001000000484	Morjina Khan	01701161150	shirin@hotmail.com	NORMAL	fp_b77622207f1987a8cd456683c9a4309d	4	22.35455671	91.76227423
00000001000000485	Shahriar Sarker	01857461713	shofiq55@gmail.com	NORMAL	fp_374ecce39595a1aa79eb46fcc77841de	5	22.32027325	91.85661271
00000001000000486	Ayesha Islam	01691930384	ayesha@gmail.com	NORMAL	fp_0b02cf746b8293ff492200870f41a9d3	6	24.35559803	88.58864250
00000001000000487	Gias Sarker	01752576121	sarker@outlook.com	NORMAL	fp_3eb3c9bd375821a02224a811006c0bc9	7	24.85547297	89.35132805
00000001000000488	Shahrukh Hossain	01422595737	hossain@bdmail.net	NORMAL	fp_a4582bc3ce4a62c2e85e7a702fb6d718	8	22.80627188	89.53581476
00000001000000489	Mohammad Mia	01717710062	hossain@gmail.com	NORMAL	fp_4a4ef9042590ce317ecea64b1d883fb8	9	23.17560687	89.18176142
00000001000000490	Morjina Akter	01828242742	hasanahmed@hotmail.com	NORMAL	fp_5000eb637bfdf13cdcfa8d52bfa06d7a	10	24.88023850	91.87074689
00000001000000491	Rokeya Begum	01277248773	nasrin@yahoo.com	NORMAL	fp_7d816c32d0caad0623ce1ec237cc9419	1	23.87582899	90.40425659
00000001000000492	Shahjahan Rahman	01501188098	shahin66@yahoo.com	NORMAL	fp_6d438e3000d07aebc40bf18288c2324c	2	23.80007838	90.37779522
00000001000000493	Parvin Akter	01939046219	chowdhury@hotmail.com	NORMAL	fp_67127768c47f8f24a042757327a4d237	3	24.01344567	90.40141462
00000001000000494	Quazi Rahman	01469476378	shahana@bdmail.net	NORMAL	fp_ec292d355f355e74347f0363489c80a9	4	22.37984575	91.79559856
00000001000000495	Mir Haque	01973940732	nargis@hotmail.com	NORMAL	fp_12e50f54fe5c59356bb189a5aaa4fc25	5	22.31941431	91.83088097
00000001000000496	Md. Morshed	01375396269	ali@yahoo.com	NORMAL	fp_e07cddcc32c9da61b28dd0b942b5fbb9	6	24.35773082	88.58748188
00000001000000497	Shah Mia	01982718392	karim56@hotmail.com	NORMAL	fp_8536a10543f660e8c9baed880b34327c	7	24.85540496	89.35372086
00000001000000498	Lima Islam	01501421864	rabeya@outlook.com	NORMAL	fp_2cec67e686a4c5b221cad5ad3f603ca9	8	22.82022967	89.56624285
00000001000000499	Nargis Begum	01374527238	shahin@gmail.com	NORMAL	fp_c276898016fb22c48659952c7db62018	9	23.15264112	89.20806674
00000001000000500	Shahjahan Rahman	01236516727	jamal@outlook.com	NORMAL	fp_546c718bbcf2398fcd217058c747c05c	10	24.88224885	91.88138375
00000001000000501	Muhammad Khan	01527505528	shahin24@bdmail.net	NORMAL	fp_dbd5c9d2f539b2986a362ca5886b0daf	1	23.85301217	90.36355732
00000001000000502	Shahjahan Mia	01900643037	parvin@yahoo.com	NORMAL	fp_5ac53feb7160b5aa8bfee146418444ee	2	23.77610433	90.38474236
00000001000000503	Abu Hossain	01144172035	salamali@outlook.com	NORMAL	fp_a4da5153f4e26a07ef64ced3b7c45297	3	23.97746036	90.42478760
00000001000000504	Muhammad Sarker	01627570709	kamalhossain@gmail.com	NORMAL	fp_dde480397f520e5730f9c50c4bd60c0d	4	22.36591950	91.78665966
00000001000000505	Shahnaz Sultana	01176093209	salamali@hotmail.com	NORMAL	fp_5504f91633523c1a9c1e5c1cc60f7388	5	22.35175206	91.82330709
00000001000000506	Nasrin Begum	01609126347	jamal41@hotmail.com	NORMAL	fp_cf386872dbd266097e8a20a72a563d6b	6	24.36992265	88.59701080
00000001000000507	Mohammad Ahmed	01743168118	karim4@gmail.com	NORMAL	fp_0392ab6ce93e72b03fe58d244edfccf3	7	24.84570572	89.35403877
00000001000000508	Md. Kamal	01769477401	shahin@hotmail.com	NORMAL	fp_ece1ce713fca53c82988013f85a5e3da	8	22.79110793	89.56963386
00000001000000509	Md. Kamal	01866948455	ahmed@outlook.com	NORMAL	fp_abed1c8a08f9c2b115789fbc7264eda8	9	23.14761182	89.18662374
00000001000000510	Shahinur Khatun	01708888152	shirin@hotmail.com	NORMAL	fp_483ceec83f6332f7708573efc97b6c68	10	24.87290143	91.87755653
00000001000000511	Nasrin Rahman	01577642946	das@hotmail.com	NORMAL	fp_e0f5825bbdec7b99fdfadba6c6e5708a	1	23.86042219	90.40197497
00000001000000512	Shirin Begum	01512119380	salammia@gmail.com	NORMAL	fp_baeda7e64a3783767ad59faae4875c86	2	23.76896109	90.39882234
00000001000000513	Md. Barkat	01516506109	jamalislam@outlook.com	NORMAL	fp_1b78ad7159ba368b12623f88edc5a4bd	3	24.01982882	90.42166161
00000001000000514	Shamima Islam	01796496495	ali@yahoo.com	NORMAL	fp_caf4b4b5480669354d260cb87aec6b7f	4	22.37377368	91.77958981
00000001000000515	Shila Chowdhury	01130386540	shahana@gmail.com	NORMAL	fp_cbec845379e72f253aabb57852c8034e	5	22.34674950	91.84510171
00000001000000516	Nasrin Begum	01113225111	hasan70@yahoo.com	NORMAL	fp_5b6d01f68285f1649b0d0b2bc3e1b23f	6	24.37069122	88.61818252
00000001000000517	Golam Hossain	01855989212	shahin12@hotmail.com	NORMAL	fp_8f9fda11abd7527fc5754a7141221c92	7	24.82848960	89.37920598
00000001000000518	Ahmed Ahmed	01837889443	jamal@gmail.com	NORMAL	fp_8268edfa078fad4a50205a7998e9733b	8	22.82714335	89.54959230
00000001000000519	Md. Rafiq	01388857480	ahmed@yahoo.com	NORMAL	fp_00f38a3728532037d8cf46c6724855d8	9	23.17445165	89.21370194
00000001000000520	Md. Shahid	01547615554	rokeya@bdmail.net	NORMAL	fp_e54a68767f8dd2db1f18e23ea9b24842	10	24.91524335	91.87331851
00000001000000521	Shahinur Khan	01716178752	shahin51@gmail.com	NORMAL	fp_0c7cabee53eaff1ae1837cadadccb2a8	1	23.89746560	90.38355068
00000001000000522	Rokeya Begum	01933513129	khadija@outlook.com	NORMAL	fp_4abd8ce7efacd2c51a2729202bbc0c13	2	23.80386539	90.39427964
00000001000000523	Abdul Hossain	01261292961	islam@outlook.com	NORMAL	fp_d79e387856836b872fd5452c77926da0	3	23.98599420	90.39977963
00000001000000524	Marium Khan	01666848640	sarker@yahoo.com	NORMAL	fp_11989a5907dab1af035561f759ffabc4	4	22.34947687	91.79573123
00000001000000525	Shila Chowdhury	01281471148	hossain@gmail.com	NORMAL	fp_479bd109f973d516329e129c9185e92b	5	22.33376258	91.81271952
00000001000000526	Khadija Begum	01822437601	das@bdmail.net	NORMAL	fp_c3821a39e9b4bf824d34b5deda2c3b52	6	24.37123062	88.59041430
00000001000000527	Nasrin Sultana	01727971840	rahimhossain@hotmail.com	NORMAL	fp_07ea72adf5ca0ec3bf309fae3dcc03df	7	24.82612383	89.38961973
00000001000000528	Rabeya Islam	01134911268	jamal@yahoo.com	NORMAL	fp_7ac91ed2ace1873023a2bb572b68c15c	8	22.83612381	89.54106166
00000001000000529	Ripa Akter	01181579741	hossain@outlook.com	NORMAL	fp_344dd368e72fa9d769b4c1a18b9a22b3	9	23.18610103	89.18732372
00000001000000530	Shahana Rahman	01796980323	sarker@hotmail.com	NORMAL	fp_20bdbc98c21fc3f99817d58c830032fe	10	24.91864467	91.87974978
00000001000000531	Jahanara Begum	01366948729	salammia@yahoo.com	NORMAL	fp_6530aa5cf18bb970c69999e1fcca446b	1	23.86659491	90.35638773
00000001000000532	Abdul Rahman	01392193853	kamalislam@gmail.com	NORMAL	fp_e56098f6fa7457135252b79f1e73b52a	2	23.80030114	90.39266347
00000001000000533	Shah Ali	01552300176	jamal@hotmail.com	NORMAL	fp_177873702c99eddc63c258cdc32de271	3	23.97679536	90.41311471
00000001000000534	Shahida Begum	01602158891	das@outlook.com	NORMAL	fp_57130cee0e3e269fb19083d70354d2ac	4	22.35898918	91.79018646
00000001000000535	Md. Barkat	01201682777	islam@yahoo.com	NORMAL	fp_cfd606bcf889cea671c2cc9d99545f76	5	22.33620493	91.81256321
00000001000000536	Md. Morshed	01547446287	rabeya@outlook.com	NORMAL	fp_40a533132e47ffab75fdedf6aac499d4	6	24.36992431	88.59058525
00000001000000537	Shahzad Ahmed	01187377407	hasan@bdmail.net	NORMAL	fp_1621f2158af79b35b7b086e09c23d5b6	7	24.87029649	89.39665829
00000001000000538	Shirin Sultana	01239149847	nasrin@yahoo.com	NORMAL	fp_356118b03a330b909e1a83157ea3d1b0	8	22.83732685	89.53985659
00000001000000539	Ayesha Hossain	01646657496	chowdhury@hotmail.com	NORMAL	fp_3d59e60c0bb6ef5e9ff631d68eb01dd2	9	23.16643049	89.18648175
00000001000000540	Khadija Rahman	01460179476	rafiq@gmail.com	NORMAL	fp_ff41ea6b16b8fdef1c779558d0e8c565	10	24.89079099	91.86496558
00000001000000541	Shamsul Sarker	01311181534	barkat22@yahoo.com	NORMAL	fp_7a975141197b218b12b4dbf137d1f1fe	1	23.87469309	90.38365003
00000001000000542	Abdur Khan	01116500880	salamkhan@bdmail.net	NORMAL	fp_88ca8be05332d643bc64b6f5b66fab7f	2	23.77563972	90.38277495
00000001000000543	Shamima Khan	01717363009	jamaldas@gmail.com	NORMAL	fp_4e87ab423f447abb89a83556424172c7	3	24.01904526	90.41028295
00000001000000544	Abul Islam	01213704273	nasrin@yahoo.com	NORMAL	fp_7f79c6f558414126b17b347536389147	4	22.33980064	91.79798779
00000001000000545	Halima Hossain	01122721666	sarker@outlook.com	NORMAL	fp_6f3cd770dea0d3f5ac590db297190dca	5	22.34268527	91.84672851
00000001000000546	Shirin Begum	01518282927	salam66@hotmail.com	NORMAL	fp_eadf7935d24bbe01d20ad503d9f29f83	6	24.39825225	88.61627609
00000001000000547	Shirin Begum	01682258250	shahin@outlook.com	NORMAL	fp_892d16b958fbb804d9c0e346fdacef64	7	24.87000247	89.37399445
00000001000000548	Shima Islam	01782282728	kamalsarker@outlook.com	NORMAL	fp_4b422e37dd17305a6ea6dfd9e45078d0	8	22.83984597	89.55557692
00000001000000549	Abu Sarker	01293183217	ali@outlook.com	NORMAL	fp_f68b0fcd4109f3eb69f722cadf7d1f01	9	23.15940520	89.21339127
00000001000000550	Abul Sarker	01620927091	kamal19@bdmail.net	NORMAL	fp_bae3fc028831cfa94222c41347f9a26c	10	24.91953667	91.86181417
00000001000000551	Farida Hossain	01840693452	rafiqmia@yahoo.com	NORMAL	fp_020fff17c27adb460ecb7358b89bc5d8	1	23.86465710	90.37917813
00000001000000552	Md. Mostafa	01711890060	rafiqhossain@outlook.com	NORMAL	fp_e8897fdfc7ed5c142b70a955e1eedad1	2	23.79548036	90.36762455
00000001000000553	Shamima Rahman	01605339548	shirin@hotmail.com	NORMAL	fp_77aefcf0dd65848eb8c887b5ed9d0f62	3	23.97530731	90.40998916
00000001000000554	Lutfur Hossain	01873445775	salamdas@bdmail.net	NORMAL	fp_10ed66af5058b848910b1ae6497e920e	4	22.37747734	91.79203318
00000001000000555	Shirin Begum	01769068955	khadija@gmail.com	NORMAL	fp_6c76213fdddb5e362e96944ddb4e1b80	5	22.35618770	91.83836404
00000001000000556	Md. Rahim	01438852021	kamal@outlook.com	NORMAL	fp_bb2990b233bc9fdcf0885781a44313d6	6	24.37118050	88.58874354
00000001000000557	Shahjahan Islam	01485422630	karim@outlook.com	NORMAL	fp_57aa7c405f40bde4ce8e2e740eb6930d	7	24.83702778	89.34902621
00000001000000558	Shahadat Islam	01825446180	mia@yahoo.com	NORMAL	fp_08648a2ff49cff3e03f387c4fccb57d9	8	22.80576413	89.57790919
00000001000000559	Mir Hossain	01679830776	kamalkhan@yahoo.com	NORMAL	fp_f3c8115409c7d18e46cf23b3fdd4f7b6	9	23.18217704	89.20660639
00000001000000560	Nasima Akter	01914558235	nasrin@hotmail.com	NORMAL	fp_3cd2a5fdfa2d06e8b971308e7b13657d	10	24.89302820	91.88231257
00000001000000561	Golam Hossain	01834813959	shofiq1@yahoo.com	NORMAL	fp_a371d25a2cf6c056418409db0e28ae4d	1	23.86107624	90.37025044
00000001000000562	Mir Hossain	01947689866	karimmia@yahoo.com	NORMAL	fp_ff9c107a3a29ea76bab11b242bdb3c77	2	23.77676016	90.38365221
00000001000000563	Nargis Begum	01717267941	jamaldas@yahoo.com	NORMAL	fp_3939293503661c8dde118c89bc5a0c28	3	23.98083611	90.40373655
00000001000000564	Halima Sultana	01268104522	shofiqchowdhury@hotmail.com	NORMAL	fp_3fc237ebee6d02870ce1dac50f7bc635	4	22.36900872	91.78598604
00000001000000565	Shahadat Ahmed	01555946873	rokeya@yahoo.com	NORMAL	fp_65d713f5298cd5449045014c9697f110	5	22.31236589	91.81615119
00000001000000566	Shirin Begum	01689249665	jamalkhan@outlook.com	NORMAL	fp_b8365c5bd6c7c6c14ea51cd853e849b7	6	24.38213930	88.59584966
00000001000000567	Shah Chowdhury	01916762154	rafiqhossain@hotmail.com	NORMAL	fp_e66a877e5519699fab2c09b50de11ae6	7	24.86082208	89.38670412
00000001000000568	Md. Jabbar	01292721799	shahinahmed@bdmail.net	NORMAL	fp_e52c87967453bc2d2f2a429a3ec5f523	8	22.80219258	89.54596267
00000001000000569	Shahid Islam	01598567282	rokeya@outlook.com	NORMAL	fp_f7972414f8d14fc35e10319febc8e940	9	23.17706784	89.18958642
00000001000000570	Abdul Islam	01288224607	rahimrahman@bdmail.net	NORMAL	fp_21b067b5dcd840500a5e70c6d50d287b	10	24.91624154	91.85763028
00000001000000571	Syed Sarker	01694751666	ayesha@yahoo.com	NORMAL	fp_86eab7399180ae9c1ba0875f2073b282	1	23.87498147	90.39379367
00000001000000572	Nazma Khan	01670459436	ahmed@hotmail.com	NORMAL	fp_c0e195c71174aa8006268eb8113cd7c2	2	23.79737565	90.39991807
00000001000000573	Nasrin Khatun	01954679166	mia@hotmail.com	NORMAL	fp_d272b7c79be65bb7599108f4487f1460	3	24.01229848	90.42856202
00000001000000574	Md. Shahidul	01177483504	hossain@outlook.com	NORMAL	fp_cf827d742c259a5c420c77a36a5c44d0	4	22.34379687	91.76008368
00000001000000575	Md. Rafiq	01673023254	parvin@outlook.com	NORMAL	fp_aa7646ad5f17a5574d2d85f4231bab56	5	22.33657265	91.83866038
00000001000000576	Shirin Begum	01728283140	khadija@hotmail.com	NORMAL	fp_c1c1f5df3ba127b9c72625bd94b260c9	6	24.37266331	88.60518552
00000001000000577	Farida Begum	01111992664	shahin@yahoo.com	NORMAL	fp_6b79f6285834047f9ce9e5c24ce219a4	7	24.84831467	89.36372831
00000001000000578	Chowdhury Islam	01732458861	rahimahmed@hotmail.com	NORMAL	fp_f255c87f7e0b3abe2abdafbd7847c960	8	22.80077084	89.53927203
00000001000000579	Rabeya Begum	01424910275	rafiqrahman@hotmail.com	NORMAL	fp_6f57e7bdb2446c8589f852e641844824	9	23.19339974	89.18507718
00000001000000580	Tania Begum	01691733996	salamchowdhury@hotmail.com	NORMAL	fp_42da5e38af9f04c7a54ddaf2ea9855dd	10	24.89539720	91.86928854
00000001000000581	Lutfur Hossain	01846643553	rahman@outlook.com	NORMAL	fp_77944f1ac300b3dafb74a214a2b86b95	1	23.87580110	90.36112355
00000001000000582	Rokeya Begum	01742511514	islam@yahoo.com	NORMAL	fp_bb641164ed31664cbc678342ccbcff9e	2	23.76343013	90.36846723
00000001000000583	Tania Begum	01983852758	chowdhury@yahoo.com	NORMAL	fp_bd2ea31376318aaaa081d6ad7f6bff76	3	24.00353050	90.41012561
00000001000000584	Sheikh Sarker	01296542140	shahinislam@bdmail.net	NORMAL	fp_e14d3b0ecf7610ed5186c0cb24276156	4	22.33369247	91.78041193
00000001000000585	Marium Hossain	01656105839	nargis@hotmail.com	NORMAL	fp_1d6d89f12127e69ce902185a92066a01	5	22.31598507	91.81862099
00000001000000586	Tania Begum	01451727425	fatema@bdmail.net	NORMAL	fp_2a366278494ffc7a6b5286b58c677614	6	24.37162543	88.58810998
00000001000000587	Nasima Akter	01335646870	mia@outlook.com	NORMAL	fp_2545c3362c37cb0739702a31e3c9427d	7	24.83228956	89.34960642
00000001000000588	Shahadat Khan	01689926363	sarker@yahoo.com	NORMAL	fp_b8e7fa8c7d3ca367bc39bb8bcf8ce007	8	22.82607237	89.57323232
00000001000000589	Shahid Hossain	01884992700	hasan@yahoo.com	NORMAL	fp_8ea38ab6ed5b0677c9dc02ad8556e974	9	23.16263021	89.18271831
00000001000000590	Shahnewaz Sarker	01502376835	jamal27@outlook.com	NORMAL	fp_1a1c895eea09209185ee5a96f1bf42e7	10	24.90875520	91.87145893
00000001000000591	Rabeya Hossain	01623214079	parvin@hotmail.com	NORMAL	fp_459eb9ff48c8b82e180445c53710228e	1	23.86932569	90.36074517
00000001000000592	Lutfur Ahmed	01326274178	das@yahoo.com	NORMAL	fp_d8e18ef0d8b72391b8372116d000a579	2	23.78186306	90.36736365
00000001000000593	Shirin Begum	01991338594	shahinhossain@hotmail.com	NORMAL	fp_103066518b33663c9b1f3714f610d5a9	3	24.01249678	90.42946461
00000001000000594	Shahnaz Chowdhury	01878610500	kamalkhan@yahoo.com	NORMAL	fp_9cf30174b814196417d4fbaff79f2d18	4	22.35234403	91.79579217
00000001000000595	Md. Barkat	01396009467	chowdhury@yahoo.com	NORMAL	fp_12d86e8ff29f49bb809f33754f3ad80f	5	22.35037539	91.82371061
00000001000000596	Shahida Hossain	01337630757	salam27@bdmail.net	NORMAL	fp_994da900ed019c5c0118a210e8733249	6	24.36557965	88.59513864
00000001000000597	Md. Salam	01712623491	rahman@outlook.com	NORMAL	fp_bebd77490ae7997969f05caa08a8079b	7	24.83237979	89.38148056
00000001000000598	Shahnewaz Rahman	01700527893	shofiqmia@bdmail.net	NORMAL	fp_d2be66a4015f575f955e3ed78e058587	8	22.83982408	89.55216730
00000001000000599	Syed Sarker	01814815634	shofiq42@outlook.com	NORMAL	fp_6b70d90dbd4bcc77edecd45292df9e09	9	23.17222881	89.19214119
00000001000000600	Rina Khatun	01204262231	kamal5@outlook.com	NORMAL	fp_625cab8cf5eb200f01e458f55c15ae43	10	24.89720681	91.87705671
00000001000000601	Md. Nurul	01616743384	salam@outlook.com	NORMAL	fp_9006797142a932a3ce4df76901ef0e83	1	23.86422031	90.37914328
00000001000000602	Abul Hossain	01748460702	kamal@hotmail.com	NORMAL	fp_a89aef162a778d18b0bdbf363a113df3	2	23.77312469	90.39342951
00000001000000603	Mir Mia	01485959334	jamalhossain@hotmail.com	NORMAL	fp_0a46e502c9b5ba2626484fd27ecb5c7e	3	23.99035742	90.42212496
00000001000000604	Farida Rahman	01592794613	jamal@yahoo.com	NORMAL	fp_3e306c6f603f8e75de64e26b958b0183	4	22.37057651	91.80711526
00000001000000605	Md. Kamal	01288186707	rahim61@outlook.com	NORMAL	fp_bd0043703f1169b9490567dc252d43ef	5	22.34340227	91.85514412
00000001000000606	Shahid Islam	01444882922	das@hotmail.com	NORMAL	fp_24c526addc7d9d7bd3760c8beef3f5f4	6	24.35824214	88.60754423
00000001000000607	Shahrukh Rahman	01208668549	fatema@hotmail.com	NORMAL	fp_a45574c868b619e9ad4df6c6589d71b1	7	24.84517446	89.34704111
00000001000000609	Shahnewaz Islam	01248342469	islam@hotmail.com	NORMAL	fp_dc73dbc0a74074e2809fbd218b654c3b	9	23.15303542	89.20588015
00000001000000610	Abul Hossain	01879638574	ahmed@bdmail.net	NORMAL	fp_c8f89a8e67a1bf8334dd71276c1c7d2e	10	24.90173607	91.84777634
00000001000000611	Lutfur Chowdhury	01343807267	hasan38@gmail.com	NORMAL	fp_c5b64d07e6b0f57a3eadd0dc6412cb09	1	23.87756565	90.37082851
00000001000000612	Md. Rafiq	01655938888	shahinislam@bdmail.net	NORMAL	fp_fe522a1c560eac990ed315d9cd8dd7b6	2	23.80448621	90.35992264
00000001000000613	Sultan Ahmed	01343340571	shahin@bdmail.net	NORMAL	fp_56784a56f47196260854ac977ed229a8	3	24.01478527	90.43223244
00000001000000614	Md. Rafiq	01201130672	mia@bdmail.net	NORMAL	fp_040af23790f4de8b8f61feecd6681d71	4	22.36081808	91.77325092
00000001000000615	Md. Morshed	01220817951	hasan@yahoo.com	NORMAL	fp_6fec521f2874c713640d7861866aa8a2	5	22.34478064	91.83004966
00000001000000616	Ms. Begum	01398221102	rafiq@yahoo.com	NORMAL	fp_75fb6333aea3dd79951d1175c399a69d	6	24.36844057	88.61020545
00000001000000617	Nasrin Mia	01711320478	khan@bdmail.net	NORMAL	fp_f770aad63363605d68347335a0a2dae9	7	24.84336980	89.36334367
00000001000000618	Md. Rafique	01998650153	jamal75@yahoo.com	NORMAL	fp_f31851526f55360c6564e6a4bbdc65e5	8	22.83047386	89.57357808
00000001000000619	Md. Shahid	01150528133	nargis@bdmail.net	NORMAL	fp_0e76bff7a7968f64e085da667ae0ff93	9	23.17826654	89.21831015
00000001000000620	Shirin Begum	01293690897	hossain@hotmail.com	NORMAL	fp_e0dc677d548135553c6eba111d306137	10	24.91119355	91.84397179
00000001000000621	Lima Khatun	01102764489	das@outlook.com	NORMAL	fp_b05f405e4bceb0fb6f63fd3d86668faf	1	23.86510664	90.39000529
00000001000000622	Shahriar Mia	01641876388	rafiqdas@yahoo.com	NORMAL	fp_fd8fe00716a0b41ba7619b7a85ca50ee	2	23.75896505	90.38999921
00000001000000623	Parul Begum	01224344515	kamalrahman@hotmail.com	NORMAL	fp_9cccc4d8abfae49e16ace4e7988ea782	3	23.98680734	90.41098643
00000001000000624	Farida Khatun	01990319340	rahimislam@outlook.com	NORMAL	fp_2b849b45964a6939ba3cd8ca93deae88	4	22.35593360	91.80557713
00000001000000625	Nipa Hossain	01637492073	chowdhury@yahoo.com	NORMAL	fp_f8ddf2a51ca6b0a0376397fb7f5b59c8	5	22.32587161	91.84910468
00000001000000626	Shahadat Hossain	01345550563	mia@yahoo.com	NORMAL	fp_6b91e00a559c3de283bf90585e402370	6	24.35938462	88.62745131
00000001000000627	Md. Shahed	01682795865	jamal@bdmail.net	NORMAL	fp_a93122eed1f1730733b419ff075b6e96	7	24.87524169	89.35687114
00000001000000628	Abul Das	01751786819	nasrin@yahoo.com	NORMAL	fp_4287c6d22f80a26b6b6d2d7c18eabfc8	8	22.80859419	89.55576351
00000001000000629	Shah Hossain	01159200733	barkatchowdhury@bdmail.net	NORMAL	fp_ca995d18e8fa2001cc26f7b1c60e6a5f	9	23.14627940	89.21160219
00000001000000630	Ripa Khatun	01141213454	kamal@gmail.com	NORMAL	fp_a8a6adaff3c5d958a9bedb7489223ebb	10	24.87216649	91.85530477
00000001000000631	Muhammad Mia	01598024866	jamal@yahoo.com	NORMAL	fp_54aacc65dbe452dd18797e1d45a1f785	1	23.85115148	90.36068128
00000001000000632	Marium Rahman	01704934247	kamalkhan@gmail.com	NORMAL	fp_ba86fa84edd2df6bebf8ef5e71e7d470	2	23.75620005	90.37050464
00000001000000633	Saleha Akter	01448051441	shofiqrahman@hotmail.com	NORMAL	fp_908e0cc77e24be53e96ba7db96bc20d8	3	24.01350076	90.41145691
00000001000000634	Abu Mia	01944539440	shofiqhossain@hotmail.com	NORMAL	fp_fe3ea4526fa1ccd44cd62d760e2eb901	4	22.34508156	91.80050145
00000001000000635	Syed Mia	01760510580	rokeya@yahoo.com	NORMAL	fp_50097792fc94099243bb8322c1f04919	5	22.34810991	91.81640117
00000001000000637	Ahmed Ali	01654243157	mia@yahoo.com	NORMAL	fp_d1a48deb5b43bef74aca888ecd0508bd	7	24.86125385	89.39653778
00000001000000638	Shahinur Begum	01344112794	jamal2@outlook.com	NORMAL	fp_9d72cac4a6e9ba3793dc83c0716ab220	8	22.82196445	89.54643926
00000001000000639	Marium Akter	01968424323	nasrin@outlook.com	NORMAL	fp_6d87658fc8415a59b9e244b599e96af2	9	23.17888928	89.18698901
00000001000000640	Quazi Chowdhury	01852556105	hossain@outlook.com	NORMAL	fp_495a50bcd4a915c28c1c10fedc71e410	10	24.88289246	91.84514981
00000001000000641	Shahnaz Khan	01323924682	shofiqsarker@gmail.com	NORMAL	fp_e63c9feaddc1b12da0e3be57282b52f2	1	23.87604945	90.39546894
00000001000000642	Md. Hasan	01605818287	sarker@bdmail.net	NORMAL	fp_19df056f895c4413858e6687b530f6b8	2	23.76225068	90.40351930
00000001000000643	Ayesha Akter	01347555291	mia@yahoo.com	NORMAL	fp_4fc70e439f79af07d39efb8c2912a352	3	24.01371162	90.42344086
00000001000000644	Lima Sultana	01184832485	ahmed@hotmail.com	NORMAL	fp_a93d6171cd864e3a095a7dc101237946	4	22.35682626	91.77977806
00000001000000646	Farida Akter	01485682628	kamal7@bdmail.net	NORMAL	fp_98ad3788d501fe9c934200fb2d6bea80	6	24.38651909	88.61225868
00000001000000647	Ms. Hossain	01742578020	chowdhury@gmail.com	NORMAL	fp_80003e348b12e9756184d33763539be2	7	24.85394156	89.35590107
00000001000000648	Saleha Begum	01608471678	karim@yahoo.com	NORMAL	fp_ffdd56616311068f8e235aa69c692e88	8	22.82127037	89.56660260
00000001000000649	Nur Das	01832865175	hasanchowdhury@outlook.com	NORMAL	fp_0d5d85135eace5b911317693bae04000	9	23.16143980	89.18036901
00000001000000650	Abdur Mia	01463988023	shahinali@yahoo.com	NORMAL	fp_b0de400109dcce23388ce24267283777	10	24.87528480	91.85125102
00000001000000651	Shima Khatun	01203851098	ayesha@yahoo.com	NORMAL	fp_eec69213452910a63dbcf33c43240748	1	23.85561424	90.36491812
00000001000000652	Golam Sarker	01319829915	khan@bdmail.net	NORMAL	fp_12e4cdca04f7d4c3192383fbba68c8c8	2	23.76671565	90.36943792
00000001000000653	Nasrin Begum	01790702008	khadija@gmail.com	NORMAL	fp_fd0146644c7936681664ca4a1ee5c877	3	23.98526792	90.43669285
00000001000000654	Shirin Jahan	01250895759	shofiq43@hotmail.com	NORMAL	fp_81f657558121c29fc1a7b579b98e59cd	4	22.36562815	91.78819502
00000001000000655	Shahnewaz Islam	01186533757	khan@outlook.com	NORMAL	fp_080d54faf786e9a771d16c094b2324d6	5	22.31302012	91.81115373
00000001000000656	Lima Hossain	01157096448	shahin69@outlook.com	NORMAL	fp_f48ca4ba6727e3b3fa4eefbd6d8de957	6	24.35032880	88.58252247
00000001000000657	Lima Khan	01733679710	sarker@bdmail.net	NORMAL	fp_4eb7456f0db37829e1dd956d21e7c0be	7	24.84667430	89.37761458
00000001000000658	Nasima Akter	01162038480	shirin@yahoo.com	NORMAL	fp_f81dfa06a1275a4ae3b596bae2044e58	8	22.80762285	89.56211396
00000001000000659	Tania Sultana	01633360386	khan@gmail.com	NORMAL	fp_bcd69933b8b23bedb72c0a3e1c657cf4	9	23.17349182	89.22517298
00000001000000660	Md. Mostafa	01848327096	hasan24@outlook.com	NORMAL	fp_2e523cbede0c9db8cccbbeb81642a152	10	24.90093869	91.84411065
00000001000000661	Lima Khan	01365014977	nasrin@hotmail.com	NORMAL	fp_2b2a2c6180589effe357775f250f6189	1	23.86905415	90.38591596
00000001000000662	Nasrin Begum	01225411473	sarker@yahoo.com	NORMAL	fp_3a1cfe7ac1fbedbf514862f8180e5c1d	2	23.76763038	90.37172358
00000001000000663	Chowdhury Ali	01496360896	rafiqislam@bdmail.net	NORMAL	fp_7cd2b02e08f042903cb2572085325eb9	3	23.99722095	90.39953339
00000001000000664	Md. Salam	01165750099	nasrin@bdmail.net	NORMAL	fp_ab8d0a78fcc59feba64761d6ee6ee6d7	4	22.34156804	91.76204356
00000001000000665	Shamima Rahman	01906481656	shofiqsarker@outlook.com	NORMAL	fp_f636fe150b31a7a6c7dcb6198024235d	5	22.32377751	91.80973324
00000001000000666	Mohammad Ali	01980851985	salamkhan@hotmail.com	NORMAL	fp_63e9c6ea6388663bf21214e33fed84d9	6	24.39631504	88.61744471
00000001000000667	Shahadat Ali	01114529052	fatema@bdmail.net	NORMAL	fp_ec8b007cc3d5a49d4825762dbe23d238	7	24.85128058	89.36559779
00000001000000668	Shahid Rahman	01350206637	islam@yahoo.com	NORMAL	fp_743356db0cc438d9cd970d7e6e49b8f5	8	22.81800340	89.57487646
00000001000000669	Mir Chowdhury	01387248781	shofiq66@gmail.com	NORMAL	fp_81d159688e37450ee821db8ecb210fbe	9	23.16258381	89.19971844
00000001000000670	Shima Jahan	01563319771	fatema@hotmail.com	NORMAL	fp_26ae11e695a47a11da5a563127d458e4	10	24.87422980	91.88269459
00000001000000671	Nur Mia	01937706424	ahmed@hotmail.com	NORMAL	fp_da131b203761349ecbba5c9fef44327d	1	23.88777916	90.40014083
00000001000000672	Shah Ali	01352049761	khadija@yahoo.com	NORMAL	fp_04f863fd58f59e0f70bf2a5998de9b0e	2	23.80049109	90.36143916
00000001000000673	Md. Hasan	01762992716	khan@yahoo.com	NORMAL	fp_7a706533fa600996d609006e38bfe67c	3	23.99043119	90.43719857
00000001000000674	Shirin Begum	01227656260	mia@yahoo.com	NORMAL	fp_3032d96be17dc36776144ac63decb704	4	22.34756784	91.78635420
00000001000000675	Parvin Begum	01916344442	salam44@hotmail.com	NORMAL	fp_c056bcc4ebdefee069212eec6c8ae3bf	5	22.35553444	91.82543908
00000001000000676	Ruma Khan	01316081803	hossain@outlook.com	NORMAL	fp_52e486b7152cb8b94db72602aecefe13	6	24.35205458	88.61327315
00000001000000677	Rina Hossain	01791747341	mia@gmail.com	NORMAL	fp_d9d51a5c142ef5ea7ea576caf6916013	7	24.85024715	89.36306121
00000001000000678	Md. Rahim	01395237768	khadija@bdmail.net	NORMAL	fp_108c44df80d8cc428acf6cbbbd4efef3	8	22.82175083	89.57653336
00000001000000679	Shahana Begum	01670804999	rafiqahmed@gmail.com	NORMAL	fp_ff98df1d859967d006448004b1d74feb	9	23.18613539	89.17920977
00000001000000680	Jahanara Begum	01474317643	ayesha@hotmail.com	NORMAL	fp_77c69928812191b4116dbae08f2216e5	10	24.88570381	91.86096236
00000001000000681	Shahida Khan	01886407598	rabeya@bdmail.net	NORMAL	fp_a3216937c76926d87fa071fee3dbc1b9	1	23.86477799	90.36337321
00000001000000682	Md. Morshed	01439567411	shirin@hotmail.com	NORMAL	fp_fb76e666db6314e8efd9421da730de0b	2	23.80477791	90.35630697
00000001000000683	Fatema Begum	01365606861	das@yahoo.com	NORMAL	fp_3fc79556a2d04ee1a5a63366b5164211	3	23.99657788	90.42194913
00000001000000684	Shamima Akter	01923460827	shirin@hotmail.com	NORMAL	fp_f9ae3b0f86a535640b4e2cb5beebe266	4	22.37920375	91.79136124
00000001000000685	Rabeya Das	01168786432	rafiqislam@hotmail.com	NORMAL	fp_78165a63742b80c8f3a5b7b3fe155eb7	5	22.33518497	91.83540305
00000001000000686	Nur Rahman	01409779232	jamalchowdhury@hotmail.com	NORMAL	fp_c9ae8c8583d6fd419b23dc6a71102c0d	6	24.36510683	88.61450714
00000001000000687	Lima Hossain	01413721629	shahin97@yahoo.com	NORMAL	fp_756c17fedb5420a1f09fbe726fedbe7c	7	24.86138312	89.37105923
00000001000000688	Shahadat Rahman	01878568738	das@yahoo.com	NORMAL	fp_17de49a0b5c395d99ccc9baa88de51dd	8	22.79996357	89.57513912
00000001000000689	Halima Rahman	01902094723	parvin@gmail.com	NORMAL	fp_e88af075fcce1ed0f65e5fee2a36464f	9	23.14865528	89.22759237
00000001000000690	Abdur Chowdhury	01490582908	rokeya@outlook.com	NORMAL	fp_1f58dcd00974bc89f95d722ead077986	10	24.88670170	91.85066996
00000001000000691	Shahana Hossain	01489783303	kamalsarker@gmail.com	NORMAL	fp_b3836c8a251ccf9725cb26db2f1a0239	1	23.88795351	90.35581394
00000001000000692	Rina Khan	01376383519	salamdas@hotmail.com	NORMAL	fp_f169ac89700ed000e298de100162de12	2	23.76119427	90.38453112
00000001000000693	Md. Rahim	01976059303	jamalchowdhury@gmail.com	NORMAL	fp_e61ff559355bb1679d08986c09149482	3	24.01311750	90.40262053
00000001000000694	Shirin Begum	01624950985	shahin58@hotmail.com	NORMAL	fp_83abb45f65ab13a92dc53183048c3313	4	22.37046652	91.75937945
00000001000000695	Parvin Khan	01611841654	shahana@hotmail.com	NORMAL	fp_aaf4a37a30e9d0e75a598700a6fa1cfd	5	22.33685553	91.83472968
00000001000000696	Md. Morshed	01767899824	jamal9@bdmail.net	NORMAL	fp_5a058013490783a0d52422b3546e912d	6	24.39359524	88.59354812
00000001000000697	Shamsul Sarker	01716910925	sarker@yahoo.com	NORMAL	fp_a74cd8471b5e50ec038952e657913130	7	24.82876081	89.38311747
00000001000000698	Shirin Rahman	01852642215	chowdhury@gmail.com	NORMAL	fp_edaf4b9d041da2d5a6993e37100ca6f9	8	22.82578158	89.58141500
00000001000000699	Shahinur Das	01576013042	ayesha@outlook.com	NORMAL	fp_82fe1a2b7be72df5d8436170692d256c	9	23.17114187	89.18353451
00000001000000700	Shah Khan	01119370055	kamalsarker@yahoo.com	NORMAL	fp_59771a3eb143f2bf555e2af2f6f58bde	10	24.89636536	91.87848988
00000001000000701	Md. Hasan	01904966666	ahmed@yahoo.com	NORMAL	fp_11c17ecc558f51d7677999109a63e548	1	23.85341131	90.37657893
00000001000000702	Shirin Begum	01413888593	kamal@outlook.com	NORMAL	fp_282bc4c3fba92573f5df4c2969b4d41c	2	23.76425915	90.36099955
00000001000000703	Md. Karim	01881292604	sarker@yahoo.com	NORMAL	fp_f8886f0435534c1a62534549a5e698be	3	23.98536215	90.40897798
00000001000000704	Ruma Jahan	01146873215	nasrin@outlook.com	NORMAL	fp_7b08e6f9dca092bbd0c6db23f8c9507c	4	22.34118559	91.76887732
00000001000000705	Mohammad Hossain	01644280655	rafiqsarker@bdmail.net	NORMAL	fp_aa4623fce8250828951ce7cf53278f8c	5	22.32531123	91.81776018
00000001000000706	Lutfur Islam	01129929038	hasanislam@outlook.com	NORMAL	fp_ba34cbb7cf0b861d0615f4f48fe065c6	6	24.36319204	88.58939959
00000001000000707	Muhammad Chowdhury	01526054581	kamal@hotmail.com	NORMAL	fp_815d2b8fa4ddbb90073f50fea645bcf2	7	24.86674092	89.39645872
00000001000000708	Halima Khatun	01166103944	rokeya@yahoo.com	NORMAL	fp_2e527fd7b571f3eaa51b84e785b3c094	8	22.82783620	89.56467994
00000001000000709	Md. Shahed	01857167022	kamalahmed@outlook.com	NORMAL	fp_ac07fe1d1725cc858bb471d229255eba	9	23.15354212	89.21736995
00000001000000710	Nasrin Begum	01607605255	khadija@hotmail.com	NORMAL	fp_e4e4fca004ea44cfd3fcc9d54c216264	10	24.88417058	91.87037712
00000001000000711	Md. Morshed	01457097479	khadija@yahoo.com	NORMAL	fp_8313b1697f2ef9093225397cb4c378bd	1	23.89003435	90.35937066
00000001000000712	Mir Hossain	01107976190	jamal@yahoo.com	NORMAL	fp_39c1a9efc0f9b0d136813214e8a821b0	2	23.76581626	90.37329649
00000001000000713	Md. Barkat	01165846946	rafiq@yahoo.com	NORMAL	fp_8eb52e4d648de5b76294f0c7560e694a	3	24.02013505	90.43717311
00000001000000714	Abdur Ahmed	01123121170	salam@yahoo.com	NORMAL	fp_f3d1d374f8ff9e293734f4fb658b967d	4	22.35585844	91.80394106
00000001000000715	Gias Sarker	01838422192	rafiq@outlook.com	NORMAL	fp_ef23314452b83f05542203e91219171a	5	22.32926513	91.81542129
00000001000000716	Shima Akter	01762346052	sarker@yahoo.com	NORMAL	fp_dfa1382c639f1373fe17e4dfdd62a079	6	24.38115504	88.60816249
00000001000000717	Ms. Islam	01209508583	salam29@gmail.com	NORMAL	fp_b00c3be1dd2ee62b1474d0081e00aea7	7	24.85970771	89.38158602
00000001000000718	Abu Rahman	01758811083	jamalchowdhury@bdmail.net	NORMAL	fp_94425c46e1415da2aacaa18786cd3a1a	8	22.82179198	89.53527583
00000001000000719	Shahjahan Chowdhury	01285643767	rafiqmia@hotmail.com	NORMAL	fp_eb0939d843cf7fe95e57a125e120ad33	9	23.17903596	89.20431333
00000001000000720	Shahzad Sarker	01480835228	karim@hotmail.com	NORMAL	fp_f240d87e12c6eb0f22a599c3ba4580fa	10	24.88415646	91.88142505
00000001000000721	Shahadat Khan	01129395188	parvin@outlook.com	NORMAL	fp_2aa3e7206699365229c3eef529377535	1	23.88608751	90.39181657
00000001000000722	Nipa Islam	01949380996	chowdhury@gmail.com	NORMAL	fp_90d6526d6a6b23bc8fc5634ffdcf1b32	2	23.79293761	90.38205442
00000001000000723	Shahinur Das	01252569928	jamal@outlook.com	NORMAL	fp_7064c87c9ff8fc0e961c31b58985515f	3	23.99531008	90.40473532
00000001000000724	Rabeya Sultana	01355556559	islam@gmail.com	NORMAL	fp_514923935384537677b7fb2940880243	4	22.33200840	91.79736572
00000001000000726	Sultan Ali	01728894551	karim@yahoo.com	NORMAL	fp_2c3c927715af7487c42a9d303f066bf1	6	24.39073444	88.58936434
00000001000000727	Nasrin Khatun	01775847714	islam@bdmail.net	NORMAL	fp_82252650c455c357677f0415ae046678	7	24.87395316	89.38469366
00000001000000728	Md. Rahim	01647931321	chowdhury@yahoo.com	NORMAL	fp_b97cf092e55e81dc22b85a6d32063fc6	8	22.82674667	89.53469981
00000001000000729	Shahana Begum	01886325531	jamal@outlook.com	NORMAL	fp_471a8b596a02e76b2a4ab8b31645f475	9	23.15187935	89.18109665
00000001000000730	Tania Begum	01100367425	jamal@hotmail.com	NORMAL	fp_78727f02f34469b35b1c19ba1826df4f	10	24.91094910	91.88880021
00000001000000731	Rina Sultana	01755772472	barkat46@yahoo.com	NORMAL	fp_4f7fa1aca7b61e139c57ecde6ed832b9	1	23.85173516	90.39155210
00000001000000732	Shahin Rahman	01455866365	sarker@hotmail.com	NORMAL	fp_5d44bd3adbed61e086f10c424b1fcee8	2	23.80291705	90.37554032
00000001000000733	Shamima Khatun	01893271832	salam@outlook.com	NORMAL	fp_e816a36b2f9b26969ebb5920f8478166	3	23.98118664	90.41909991
00000001000000734	Parvin Begum	01534559026	nargis@yahoo.com	NORMAL	fp_7ffddcda5cd16ebb4cd1eeea3ecc18bf	4	22.33347301	91.77614258
00000001000000735	Khadija Sultana	01457081261	khan@gmail.com	NORMAL	fp_c215f36fdae773526c33d1c7478520e0	5	22.32509819	91.81361030
00000001000000736	Mrs. Jahan	01593019726	kamalmia@outlook.com	NORMAL	fp_be753116ff2d7086ea85d77399cf3710	6	24.39053126	88.62619690
00000001000000737	Ruma Akter	01893869858	sarker@outlook.com	NORMAL	fp_78dd50d4c05ea7c75c4817f4e43726fb	7	24.83155623	89.36577427
00000001000000738	Shahin Ali	01861844221	mia@yahoo.com	NORMAL	fp_32c56623bbeef76146245771a45acc75	8	22.80855496	89.54404325
00000001000000739	Shahadat Khan	01183863623	shirin@yahoo.com	NORMAL	fp_a7fb63dfbcf477e6a5fbb7f49d77b542	9	23.14636580	89.19316634
00000001000000740	Md. Nurul	01942478606	rahimahmed@hotmail.com	NORMAL	fp_6eec5268f3469fcc787d27b870ef686c	10	24.88159568	91.84611177
00000001000000741	Saleha Begum	01306186680	rahimahmed@gmail.com	NORMAL	fp_b19998bbe6645499b664a28116ff44a5	1	23.87768662	90.40218582
00000001000000742	Farida Das	01726205128	shofiqkhan@hotmail.com	NORMAL	fp_eb07effeeb1f26990ad37056262ff4db	2	23.76345269	90.38382539
00000001000000743	Md. Shahed	01710403879	hasan@yahoo.com	NORMAL	fp_440233bbfc163e5094af94cf6a302c3a	3	24.00516487	90.41772240
00000001000000744	Shamima Khan	01940695371	khadija@yahoo.com	NORMAL	fp_47dd7f99df231e5c4abb941e80c07699	4	22.35757087	91.77167195
00000001000000745	Shirin Islam	01386386469	barkat92@hotmail.com	NORMAL	fp_02aa95a7597a6cff887c3065b0fb43a3	5	22.33524886	91.83842872
00000001000000746	Mohammad Das	01465589303	rabeya@hotmail.com	NORMAL	fp_1eb2f7b36e9ee9f7f7ec0854537163c2	6	24.38961065	88.61646660
00000001000000747	Shahrukh Mia	01492803723	salam@yahoo.com	NORMAL	fp_d02997d96355c2d61e75e469d48cce60	7	24.84689188	89.39433082
00000001000000748	Rina Begum	01814086768	nargis@hotmail.com	NORMAL	fp_cc78a61b2b1b437da0d16b3333daf32a	8	22.83286471	89.57244108
00000001000000749	Rokeya Begum	01991551376	jamalislam@hotmail.com	NORMAL	fp_ae89caf6e001c6b4635b38197acb3ab0	9	23.19310247	89.22806574
00000001000000750	Mina Rahman	01292269437	jamalsarker@outlook.com	NORMAL	fp_e305ee9c263febc994409bf797b50be7	10	24.87832920	91.87427578
00000001000000751	Nargis Khan	01535777855	ali@outlook.com	NORMAL	fp_b25b372990f9db8020e42d7279b72daf	1	23.85414463	90.37255272
00000001000000752	Ahmed Islam	01514299797	sarker@hotmail.com	NORMAL	fp_91d48a56d3b42d56c0452fa7424a47da	2	23.78903732	90.39301833
00000001000000753	Abul Ali	01684433516	karimhossain@yahoo.com	NORMAL	fp_711fdbd6ff86d3fd61a2975b7ce06a4b	3	24.02087298	90.40606079
00000001000000754	Sultan Hossain	01136163438	salam@yahoo.com	NORMAL	fp_8a65d59fcda66de5ea0c34d1efa107c2	4	22.37788009	91.79454450
00000001000000756	Nasima Khatun	01570490650	hasanahmed@yahoo.com	NORMAL	fp_78b80473d50ec371a2152a2a0a5f503d	6	24.36446737	88.59102094
00000001000000757	Md. Mostafa	01936245566	mia@yahoo.com	NORMAL	fp_2964596e6d75419c650a0a1ab7ffb6fc	7	24.86592854	89.36473842
00000001000000758	Quazi Sarker	01667622318	shahana@outlook.com	NORMAL	fp_69b73cef4af0b795547b29463677062f	8	22.80194680	89.55802039
00000001000000759	Shahid Ali	01359624265	ayesha@hotmail.com	NORMAL	fp_65860bf312f42d7150c671a5f26cfc7d	9	23.18689605	89.18449015
00000001000000760	Quazi Chowdhury	01477022223	chowdhury@gmail.com	NORMAL	fp_e3d0c45d236def63937d7f0f01e36688	10	24.89313347	91.85738125
00000001000000761	Md. Shahin	01742541802	salam@hotmail.com	NORMAL	fp_1b678f428fcc7e4b9b3494510d26cbfd	1	23.88549866	90.37971261
00000001000000762	Parvin Islam	01277657856	kamal@outlook.com	NORMAL	fp_368b27106fef458d736d1fdd9965dbf4	2	23.76833297	90.39199761
00000001000000763	Rokeya Begum	01263803212	salam@yahoo.com	NORMAL	fp_5b10800bd6ce0bad3044010bd340bdc2	3	23.97563596	90.42740563
00000001000000764	Marium Rahman	01171426893	shofiq79@hotmail.com	NORMAL	fp_94b1eb5631f78dce0327f3a66008c519	4	22.35185943	91.78986935
00000001000000765	Shah Hossain	01639587978	jamal68@hotmail.com	NORMAL	fp_faebcd4cda656b025a6b8caa40181f88	5	22.34424976	91.85315737
00000001000000766	Shamsul Haque	01506186211	karim@gmail.com	NORMAL	fp_17dcc3d8f5053b05795995d046a609ba	6	24.39659864	88.62266507
00000001000000767	Mina Rahman	01506096392	khan@yahoo.com	NORMAL	fp_08c2e04ceadb56504a4e0e1d8f318e14	7	24.83503800	89.39139392
00000001000000768	Md. Rafique	01996879897	hossain@yahoo.com	NORMAL	fp_2a38bad3d26a0725651887197a01cddf	8	22.83598775	89.57657031
00000001000000769	Abul Mia	01528654496	fatema@hotmail.com	NORMAL	fp_60e65f92ce399b98644a32698e774e8a	9	23.16672320	89.21616093
00000001000000770	Nipa Sultana	01118394066	ahmed@hotmail.com	NORMAL	fp_ad09c42a0ea9b409f38848b5f4f06322	10	24.88093504	91.88967881
00000001000000771	Shahin Ahmed	01926068526	salam@yahoo.com	NORMAL	fp_8bc23ba186aa40808e2a053f5db6e45b	1	23.89856454	90.38725326
00000001000000772	Abul Chowdhury	01749089000	islam@hotmail.com	NORMAL	fp_5a56189c2a49c7a3945c52778ada3128	2	23.78388342	90.38257659
00000001000000773	Md. Rafique	01193023875	khadija@outlook.com	NORMAL	fp_e24d64a33f1ad19802cdcbee74536506	3	23.97954657	90.42432591
00000001000000774	Syed Rahman	01891188741	salam86@hotmail.com	NORMAL	fp_c97f8e829fd85cbcc2b52a5dd2378851	4	22.37387017	91.79477578
00000001000000775	Shahana Begum	01248897316	das@gmail.com	NORMAL	fp_3702e7de7399c1e5aa63d4a16726c88c	5	22.32560962	91.81250462
00000001000000776	Shahrukh Hossain	01422072383	rokeya@yahoo.com	NORMAL	fp_93b5b6f0b6ec774f8b773af4504de491	6	24.38556294	88.60104872
00000001000000777	Mrs. Chowdhury	01143564191	nargis@bdmail.net	NORMAL	fp_e9dce47eb11dbac7e2e5cbab2637f8b6	7	24.84298003	89.38000884
00000001000000778	Nasrin Islam	01883599796	rahimchowdhury@hotmail.com	NORMAL	fp_f85c768f5928d90ea11c9bafd38df390	8	22.83678716	89.57650122
00000001000000779	Lutfur Khan	01978070307	khadija@hotmail.com	NORMAL	fp_3e0aa855e6f12388ed4ed381752dba06	9	23.14978544	89.19587646
00000001000000780	Mohammad Islam	01972617137	ahmed@hotmail.com	NORMAL	fp_df625c383b92b160991d4f1bb9b9043d	10	24.89700352	91.87906245
00000001000000781	Md. Rafique	01658651509	hasandas@outlook.com	NORMAL	fp_befbe7a88b39c42122d3b33188b5094c	1	23.87326150	90.39953573
00000001000000782	Halima Hossain	01715595199	rafiq13@gmail.com	NORMAL	fp_bc8b7e945dd425629f10f4f481b5c260	2	23.79939536	90.38753601
00000001000000783	Mir Hossain	01846389883	hossain@yahoo.com	NORMAL	fp_5785aea55daa5dca3bc2135107fc2be6	3	24.01409534	90.40317064
00000001000000784	Shahjahan Khan	01497931895	hasanahmed@hotmail.com	NORMAL	fp_ab01f05b0ffbdd9ff778e1f7354c24a4	4	22.36748125	91.79575910
00000001000000785	Shahnaz Khatun	01199192127	rahman@outlook.com	NORMAL	fp_8d19cc70a5e0c2ab472702b8a49bc7b6	5	22.33162932	91.85467514
00000001000000786	Shahrukh Hossain	01676984198	mia@yahoo.com	NORMAL	fp_d01ea14af3b5de61c9838de1bc87f9f3	6	24.38393604	88.59073467
00000001000000787	Jahanara Begum	01218350731	salammia@outlook.com	NORMAL	fp_c3a5fba1f2d08613e3f2894a6941e0c3	7	24.83032457	89.36050161
00000001000000788	Shahinur Islam	01199383041	ahmed@outlook.com	NORMAL	fp_b54d4fce7e5236ec90fca2df3ef7feae	8	22.83221381	89.53711973
00000001000000789	Abul Ahmed	01478458537	jamal@outlook.com	NORMAL	fp_cb181506bc6f833e75e33c7219b91405	9	23.17844546	89.22269360
00000001000000790	Parvin Begum	01378259486	sarker@bdmail.net	NORMAL	fp_024c2d34cf53799fc62a1105ac9cd75b	10	24.91591222	91.87909586
00000001000000791	Shahin Ali	01845138673	shofiqchowdhury@hotmail.com	NORMAL	fp_907bab07540b5352f9e50152590378a2	1	23.85652035	90.40422073
00000001000000792	Nasima Rahman	01958243382	barkatahmed@yahoo.com	NORMAL	fp_94d4b8615070fd3d5f1e35cbb38c1877	2	23.77356543	90.37851761
00000001000000793	Nipa Khan	01165063848	fatema@yahoo.com	NORMAL	fp_a2136f0da2ecefe4bddbc9eeb34a5a71	3	24.00367533	90.41258739
00000001000000794	Parul Khan	01962053682	shofiq19@yahoo.com	NORMAL	fp_af581f021b8bdefa6e3bede18d91a10a	4	22.34360894	91.80192163
00000001000000795	Parvin Rahman	01348314819	shirin@bdmail.net	NORMAL	fp_78d87ca8d8c1a6bc5319f094f3844c62	5	22.31439809	91.82614432
00000001000000796	Shah Mia	01462009463	khadija@hotmail.com	NORMAL	fp_573465afb4d94d991595e4146db621cb	6	24.36736485	88.59826120
00000001000000797	Dina Jahan	01479689298	kamalchowdhury@yahoo.com	NORMAL	fp_665cc3b04ee8f8dd72ef3472973e6fa1	7	24.86863337	89.37316100
00000001000000798	Nasrin Islam	01794679890	nargis@hotmail.com	NORMAL	fp_ea2653d5dce817fa1f6355a6a405ee08	8	22.80918840	89.57736929
00000001000000799	Md. Mostafa	01398344594	salam@yahoo.com	NORMAL	fp_07cb43430567550dea4bf64f273ac8ec	9	23.14905160	89.19470946
00000001000000800	Parul Khatun	01747354800	shahana@outlook.com	NORMAL	fp_67a4a9d572f1ede29bde34bfb5c7cbec	10	24.87179087	91.86982086
00000001000000801	Parul Islam	01747947806	salam3@hotmail.com	NORMAL	fp_824c0aa04d9bde7bb8b370a331a83acf	1	23.87436340	90.36200153
00000001000000802	Mst. Begum	01388879093	parvin@yahoo.com	NORMAL	fp_30f533cd8c1d1ee4947185372a556df4	2	23.78009935	90.38370583
00000001000000803	Parvin Begum	01928367161	parvin@hotmail.com	NORMAL	fp_f5eafb32e5c906386f49f1d986fc245a	3	23.98653504	90.42154226
00000001000000804	Nur Sarker	01372809398	jamalhossain@outlook.com	NORMAL	fp_0da908925c721056f3844c9ba1b2e1d6	4	22.33426497	91.78804252
00000001000000805	Gias Islam	01409888455	karimrahman@outlook.com	NORMAL	fp_5cf0274a27eb3203f461b24a3f3a1971	5	22.34086073	91.84685076
00000001000000806	Nasrin Begum	01332109758	salamchowdhury@hotmail.com	NORMAL	fp_a2ce060884300134dfe191f96d56c41f	6	24.36526531	88.58704778
00000001000000807	Nargis Begum	01606714436	rafiq@gmail.com	NORMAL	fp_dcadb8c03d2ca676ebda6c5ae8d9a9fa	7	24.86725338	89.36544375
00000001000000808	Nipa Khatun	01453849853	shahinali@yahoo.com	NORMAL	fp_44de00c216fe8fc129b622b96f0f35ed	8	22.79707352	89.53601609
00000001000000809	Nasrin Khatun	01238616343	barkatchowdhury@hotmail.com	NORMAL	fp_6e6bec491128cbfaf9e43a7b8863f18b	9	23.17414998	89.21629112
00000001000000810	Shahid Alam	01859786147	shahindas@outlook.com	NORMAL	fp_92cfa71bdda9da48ef23475ab5ba1292	10	24.88776852	91.85697590
00000001000000811	Nasrin Jahan	01983433709	hossain@outlook.com	NORMAL	fp_99d62f3bd40ce6a9e6713cf19d562012	1	23.86308701	90.37695142
00000001000000812	Md. Nurul	01444977338	shofiqislam@yahoo.com	NORMAL	fp_381c0f332886952cab363e8544e5edbb	2	23.76857330	90.35812039
00000001000000813	Halima Khatun	01491712400	parvin@bdmail.net	NORMAL	fp_fb9d764f069baa2f40e13d75fdad54d9	3	24.00949871	90.43934837
00000001000000814	Shahana Khatun	01780931099	das@bdmail.net	NORMAL	fp_5acf231016f4f884696b9a33eb9d4436	4	22.34533003	91.76918112
00000001000000815	Shahid Sarker	01926978927	ahmed@yahoo.com	NORMAL	fp_2f9d8a1dd9e79f312e47b01a6950fbda	5	22.33477901	91.81550186
00000001000000816	Sheikh Hossain	01451807872	barkatali@yahoo.com	NORMAL	fp_07a64f8ba1fee07ac2e8f13643624e79	6	24.37360071	88.60105479
00000001000000817	Shah Khan	01259247427	shahin@yahoo.com	NORMAL	fp_9898e4bb1d17bfdcae211e6d305ddb05	7	24.83061337	89.35548272
00000001000000818	Shirin Begum	01696013821	rahimchowdhury@gmail.com	NORMAL	fp_3c63448a663f189d00ed16a7ae2eb287	8	22.79403937	89.57503626
00000001000000819	Lima Khatun	01733935315	jamal3@gmail.com	NORMAL	fp_2f020fc3c7760120a95223cd31ff20be	9	23.16152258	89.20352502
00000001000000820	Gias Khan	01259911692	ali@yahoo.com	NORMAL	fp_e75567b5decbc332add029f47de7b2ec	10	24.88216713	91.87166747
00000001000000821	Nasrin Begum	01166846153	rokeya@hotmail.com	NORMAL	fp_fcc57242b5e6a45d8157ef0f282da6c4	1	23.87443310	90.40039693
00000001000000822	Md. Jamal	01940138305	shahana@yahoo.com	NORMAL	fp_908f56fdbc0144aee27ea0201b1e900b	2	23.76325193	90.39062327
00000001000000823	Md. Mostafa	01784240039	sarker@yahoo.com	NORMAL	fp_5440864113fb0be0f0c7e99bfaf5f0ee	3	24.01370961	90.40873017
00000001000000824	Muhammad Ahmed	01778314619	karimkhan@gmail.com	NORMAL	fp_5d2faab84b04e12b45ddd8e86f250ac8	4	22.34633023	91.75905531
00000001000000825	Shirin Begum	01940854060	mia@yahoo.com	NORMAL	fp_39b4e946a648a962de861b913089b5e0	5	22.34522112	91.81909813
00000001000000826	Md. Rafique	01961032816	karimdas@bdmail.net	NORMAL	fp_db3d2c89df80d559ab79994d1b4df85c	6	24.35199222	88.59829149
00000001000000827	Parul Islam	01869744290	hasanhossain@gmail.com	NORMAL	fp_7272c3b06827f6c4c49d6d30bb71332f	7	24.85562308	89.35476224
00000001000000828	Md. Jamal	01216014021	shofiq94@yahoo.com	NORMAL	fp_eb26cd74a42e810d6741bbcdc39e6a6d	8	22.83865599	89.57153673
00000001000000829	Syed Khan	01688686042	das@yahoo.com	NORMAL	fp_739bd095ccf7462c61ee5c2d372647e7	9	23.15390718	89.18136236
00000001000000830	Syed Sarker	01944028945	islam@gmail.com	NORMAL	fp_b6c4071fb30cbe19aec6a77f85e53fa5	10	24.87791553	91.88618847
00000001000000831	Sheikh Ahmed	01643150057	hossain@bdmail.net	NORMAL	fp_1edf840c7f114e5ac2395fb851c94c2d	1	23.88480759	90.36832917
00000001000000832	Shahana Akter	01267314499	islam@outlook.com	NORMAL	fp_91d9b4f3515bdc0106864038c3a571ac	2	23.77065956	90.37589650
00000001000000833	Shirin Begum	01594886661	fatema@gmail.com	NORMAL	fp_b0ef860f7dbaddb2edc8f4df7f15e76d	3	23.99333496	90.42115467
00000001000000834	Nasima Khatun	01720374281	shofiqchowdhury@outlook.com	NORMAL	fp_54c15332b3f3dd8468f836d22828338c	4	22.34028083	91.80116792
00000001000000835	Shah Ahmed	01425352673	khadija@hotmail.com	NORMAL	fp_b62d3ca24379f5f345db3909b32dd083	5	22.34487891	91.83723290
00000001000000836	Saleha Begum	01834097568	mia@yahoo.com	NORMAL	fp_03730750fdabdd3ecf461f0c7967b18f	6	24.36361492	88.62275460
00000001000000837	Abdul Rahman	01797145006	parvin@gmail.com	NORMAL	fp_e4b09acd567c864b48ebae836cbd01e4	7	24.82838128	89.37115878
00000001000000838	Shahida Begum	01990245766	shahana@gmail.com	NORMAL	fp_d2fe681336adb1f3f4d8d372a396b431	8	22.80715398	89.55380831
00000001000000839	Quazi Khan	01900687824	das@yahoo.com	NORMAL	fp_ac925588e0bb81987b12dee0585eb554	9	23.14413528	89.19397450
00000001000000840	Parvin Khan	01664982016	shofiqmia@hotmail.com	NORMAL	fp_1e6214a6f35f664eb74124c3be14e6aa	10	24.87725051	91.87396586
00000001000000841	Md. Morshed	01506940476	shahana@outlook.com	NORMAL	fp_71d4d044d40b227281a91b13ed5eed8d	1	23.85454800	90.35768237
00000001000000842	Md. Shahin	01387438056	kamalmia@yahoo.com	NORMAL	fp_5454e1a00b4800d0efeb11b0dca6133a	2	23.75823414	90.36919310
00000001000000843	Lima Mia	01149351266	kamalmia@yahoo.com	NORMAL	fp_85cdf66d956e1cdf55dca4c5cc1b1691	3	23.99919757	90.43348108
00000001000000844	Golam Mia	01321968559	salam56@yahoo.com	NORMAL	fp_4b7b27f3e6c09f0f917828cb916a6518	4	22.37567851	91.79473240
00000001000000845	Shamima Khatun	01641163682	jamal@hotmail.com	NORMAL	fp_56fd306f45f2fe7294b7f2c558af13d4	5	22.32565377	91.81551584
00000001000000846	Nazma Begum	01294568058	salam75@yahoo.com	NORMAL	fp_a5c32bfa27f2bd55222bb42a7ed5209e	6	24.35755523	88.59064691
00000001000000847	Jahanara Begum	01961150660	shahinali@gmail.com	NORMAL	fp_52664875e04f21406f252704dfe848ed	7	24.87204015	89.39211217
00000001000000848	Farida Akter	01576760075	salam@bdmail.net	NORMAL	fp_5afe63252f7a2233ff0b4733762fc4b2	8	22.83399308	89.54941130
00000001000000849	Saleha Hossain	01455542601	shahana@hotmail.com	NORMAL	fp_4397694fe68f5acb6d2c6ea25776e0a9	9	23.16394151	89.21025667
00000001000000850	Md. Shahidul	01713178540	kamal@yahoo.com	NORMAL	fp_7ad831e28020e867feecd179e53cde1b	10	24.88771097	91.84698407
00000001000000851	Golam Haque	01415332199	ayesha@hotmail.com	NORMAL	fp_3876eb67ef7f93eed71e812b9163b5de	1	23.87610670	90.36441770
00000001000000852	Nasima Khatun	01176610155	shahin@bdmail.net	NORMAL	fp_602847cbb60f8ea0e98a9c641088b2bb	2	23.76594551	90.38243479
00000001000000853	Mir Ahmed	01999790634	hasan25@outlook.com	NORMAL	fp_6acdb4fe2fc58cb3f2c10f2e835d86d2	3	24.02269472	90.40378827
00000001000000854	Shamima Khatun	01928238224	jamalrahman@yahoo.com	NORMAL	fp_a49a258cbec55d9c4efef250fc1bf907	4	22.34994293	91.76372256
00000001000000855	Md. Jabbar	01537494748	parvin@outlook.com	NORMAL	fp_154574279b4cd16aad83afcaf1d65a01	5	22.34370288	91.83956077
00000001000000856	Shahnaz Begum	01113590060	shahana@outlook.com	NORMAL	fp_629c2a0f5f1c1422bfc9af0ac0310dc0	6	24.37419280	88.58906755
00000001000000857	Md. Jabbar	01875115515	nasrin@bdmail.net	NORMAL	fp_ce6aa3be72b6f5b5dba96dabd4cbb252	7	24.86147024	89.36090651
00000001000000858	Chowdhury Haque	01209250633	nasrin@bdmail.net	NORMAL	fp_c7b2fc566536a84c0f23f675e04ed43e	8	22.81885612	89.57023817
00000001000000859	Golam Sarker	01416686665	barkat@bdmail.net	NORMAL	fp_23afdcac57f4cb688d5a78360cafbd76	9	23.18248824	89.20031543
00000001000000860	Parvin Begum	01259406544	rafiqhossain@yahoo.com	NORMAL	fp_9d6d70a4576fe3ccf6d037c851af7259	10	24.89957055	91.86030190
00000001000000861	Nargis Begum	01450610809	islam@hotmail.com	NORMAL	fp_7d67e2b7b3b518679365a032ab216790	1	23.86932084	90.37123683
00000001000000862	Shahrukh Sarker	01706322527	mia@outlook.com	NORMAL	fp_65ab06b21632e460ac2e5b045f81f5be	2	23.77614700	90.38233590
00000001000000863	Farida Islam	01860881198	shirin@outlook.com	NORMAL	fp_07afeee9e80e7825f1aaea2d0ef238de	3	24.00280886	90.40873914
00000001000000864	Farida Akter	01232744931	shahinkhan@yahoo.com	NORMAL	fp_7f22040d57b5843a1a0f95f350e46f32	4	22.34329942	91.79098657
00000001000000865	Parvin Begum	01951628360	shirin@yahoo.com	NORMAL	fp_f0f502f1edf4a1fa738424bc962e6ff2	5	22.32925867	91.83962480
00000001000000866	Rabeya Khan	01167163551	hasan21@outlook.com	NORMAL	fp_c1643e7d305ca84a7fa812a4b34ae6f9	6	24.39540729	88.61556101
00000001000000867	Mina Rahman	01702096555	rahimhossain@outlook.com	NORMAL	fp_1ca6f8f02ddfe33999afea2f4d3bfe08	7	24.84656348	89.37981552
00000001000000868	Md. Rafique	01183875460	ali@outlook.com	NORMAL	fp_b113bb4880bfd02869785f917208d7cb	8	22.80634273	89.57547194
00000001000000869	Farida Islam	01915439712	shahana@bdmail.net	NORMAL	fp_287b95f1956049af8864a87edb2d59d3	9	23.19191851	89.19691457
00000001000000870	Nasima Akter	01738456665	nargis@yahoo.com	NORMAL	fp_2d5e225867cbd80835b1610c2331f111	10	24.90183183	91.87037344
00000001000000871	Halima Sultana	01351787074	nasrin@gmail.com	NORMAL	fp_ec979f661846b0f0f9259a7dc154e742	1	23.87893988	90.38610535
00000001000000872	Lutfur Ali	01548505381	karimkhan@outlook.com	NORMAL	fp_8cc9f7947a41465d5cf763beb73b70ca	2	23.76703168	90.35829341
00000001000000873	Tania Chowdhury	01172040358	rahman@hotmail.com	NORMAL	fp_781504d6a7293047151ba13f8fd3b4a3	3	23.99886915	90.39694921
00000001000000874	Shahzad Sarker	01820210386	mia@hotmail.com	NORMAL	fp_4ebfdde0d386c2946c33ef679ab9a098	4	22.33838089	91.77345635
00000001000000875	Ruma Mia	01822578029	shirin@yahoo.com	NORMAL	fp_e610e2b3400f6e503563ee688831a6bd	5	22.31608425	91.81646125
00000001000000876	Lima Hossain	01420889500	chowdhury@outlook.com	NORMAL	fp_16e2716fd33ba843c0669bcff7f6ae08	6	24.36408833	88.61436219
00000001000000877	Abul Mia	01254044539	shofiq20@yahoo.com	NORMAL	fp_583a32ed630b414fc23f2bd78e4124a4	7	24.85422285	89.38921371
00000001000000878	Shahrukh Mia	01654645621	parvin@hotmail.com	NORMAL	fp_a6a6d7aff66c52229ce1cfdfdbf63904	8	22.82616127	89.55903694
00000001000000879	Dina Jahan	01448098622	das@hotmail.com	NORMAL	fp_1d5dcc213fa1a85ca2308dc8932d1588	9	23.14716790	89.22380838
00000001000000880	Mina Akter	01883922254	karim@yahoo.com	NORMAL	fp_3c75f29cd7773292de938747978276cd	10	24.90806657	91.87551919
00000001000000881	Farida Jahan	01127173685	jamalhossain@hotmail.com	NORMAL	fp_74c474e13dbe5f9d27f24deea0d06fdb	1	23.85604512	90.37817448
00000001000000882	Shahriar Hossain	01587743465	rafiqhossain@bdmail.net	NORMAL	fp_810445af7385a79c6000da4d6fc333ce	2	23.80192743	90.35588896
00000001000000883	Md. Rafique	01763373574	mia@outlook.com	NORMAL	fp_4734a334835373dc9ee44239e87c526a	3	24.01161453	90.39837706
00000001000000884	Nur Ali	01520813606	fatema@gmail.com	NORMAL	fp_44522952a507672c6de51e60cf172179	4	22.37798915	91.80165172
00000001000000885	Syed Islam	01776632511	rahman@yahoo.com	NORMAL	fp_e02b49e5a264c087ed47da9f6b6e0656	5	22.33757199	91.83469928
00000001000000886	Shahida Akter	01114055551	kamal@gmail.com	NORMAL	fp_894fa399ad9faf05596746a56482ffcc	6	24.37450576	88.59647309
00000001000000887	Mst. Hossain	01953046111	sarker@yahoo.com	NORMAL	fp_59720045be81564ad177138ec53c1f0b	7	24.84554459	89.37250281
00000001000000888	Shamima Khatun	01602698441	jamal84@hotmail.com	NORMAL	fp_697a76fdd8ba6cd2bf5d0171e6584be5	8	22.82020267	89.54864645
00000001000000889	Shahrukh Ahmed	01861806274	karimkhan@bdmail.net	NORMAL	fp_79438a6c8bba1997d90f5fd8e6e832a4	9	23.18740853	89.18645981
00000001000000890	Md. Nurul	01812087810	rafiq49@outlook.com	NORMAL	fp_6e6755fe5b6e87effd5da347f22307d0	10	24.91392160	91.86786336
00000001000000891	Mrs. Hossain	01845456247	chowdhury@yahoo.com	NORMAL	fp_7d61e7a2eef7b162c7c02af853d97c3d	1	23.88063583	90.37823207
00000001000000892	Mir Chowdhury	01120995594	jamalsarker@hotmail.com	NORMAL	fp_843cd978b700fbaab40912e181d9e053	2	23.76052526	90.36505701
00000001000000893	Abul Sarker	01920852746	karim24@hotmail.com	NORMAL	fp_57e5468d968628c399328087bbd80e82	3	24.02061874	90.42352984
00000001000000894	Lima Khatun	01746573894	nargis@gmail.com	NORMAL	fp_87c0edcc897a225a47938ca5184ed898	4	22.33375877	91.76086589
00000001000000895	Md. Jamal	01523189512	karimmia@gmail.com	NORMAL	fp_5686c6e218e239c9ea1bd7aad702de11	5	22.35232737	91.82821202
00000001000000896	Mrs. Jahan	01181377279	shofiqchowdhury@outlook.com	NORMAL	fp_e4631ed0acc836a9c370a553d4a0e0f5	6	24.38586925	88.61349356
00000001000000897	Nargis Begum	01774257321	khadija@yahoo.com	NORMAL	fp_1149dcaf0acb41611c705e740dfb9305	7	24.84163178	89.37646487
00000001000000898	Marium Rahman	01139072716	islam@outlook.com	NORMAL	fp_ccc12c83d88fd4481632606fe5d7eded	8	22.81428824	89.55292470
00000001000000899	Abul Mia	01794659427	parvin@yahoo.com	NORMAL	fp_d25aaedae4e8b77b0021487ecf3a7ec6	9	23.17231481	89.17933667
00000001000000900	Mir Sarker	01205088599	jamal86@outlook.com	NORMAL	fp_f6da1cd0a86a6ba1a590a7108ca96781	10	24.90505210	91.89226733
00000001000000901	Parvin Begum	01252151530	das@yahoo.com	NORMAL	fp_38dc12a9f10876e9bfc5d677a3745d12	1	23.88865718	90.35981065
00000001000000902	Shah Khan	01866036292	shofiqkhan@outlook.com	NORMAL	fp_6096da672aa6e32dcc9bfe821bb23b87	2	23.78050422	90.36913913
00000001000000903	Nur Ahmed	01490158358	islam@yahoo.com	NORMAL	fp_92e9c70bac1cb747025d8facaf6126f7	3	24.02260300	90.42104998
00000001000000904	Shima Hossain	01617912646	ahmed@bdmail.net	NORMAL	fp_ce1200e0b3b7a9790c1dea309f26b0b4	4	22.37852366	91.79035285
00000001000000905	Khadija Islam	01487483111	khadija@yahoo.com	NORMAL	fp_5dde542529911c27c7f3b457a12d48a7	5	22.33256168	91.84715790
00000001000000906	Abdur Hossain	01435096988	rabeya@gmail.com	NORMAL	fp_f1f8e104181f18b0cbe2faa595733b3b	6	24.35006015	88.58958185
00000001000000907	Rina Hossain	01124163840	rahimahmed@yahoo.com	NORMAL	fp_0974d25ea8c12f8f10fff8852eec2fd5	7	24.83755620	89.38272440
00000001000000908	Mina Jahan	01617585012	rabeya@outlook.com	NORMAL	fp_a6b56d5aa27aea3f8d5de02c71e3926b	8	22.80650729	89.57757199
00000001000000909	Syed Ahmed	01750177918	hasandas@hotmail.com	NORMAL	fp_5b4bec3e4bf5183da9c53c75dfbc0955	9	23.15521919	89.20472191
00000001000000910	Shahida Islam	01568493110	rafiq88@bdmail.net	NORMAL	fp_a52546eb7eba56d19147be38b8daa2a7	10	24.90693778	91.84572445
00000001000000911	Chowdhury Khan	01172316734	shahana@yahoo.com	NORMAL	fp_aa183e49fae9b93c0eed97ef7d7b9444	1	23.86368204	90.39291963
00000001000000912	Sultan Ahmed	01992660493	nargis@outlook.com	NORMAL	fp_1e7702e224be66f7455f7447e8f54644	2	23.78899532	90.38598719
00000001000000913	Md. Barkat	01155334697	salam@gmail.com	NORMAL	fp_73dbcd94eb6dd108b75229fb11257741	3	23.99523012	90.41771876
00000001000000914	Nazma Jahan	01832744283	salamhossain@hotmail.com	NORMAL	fp_829b4414968e933a4f86fe58c2e72c66	4	22.34917011	91.80025351
00000001000000915	Md. Barkat	01649309185	rahman@gmail.com	NORMAL	fp_ae9c457b77c3a693e0b560023a09cf21	5	22.35843676	91.84068031
00000001000000916	Halima Khatun	01973558070	ali@outlook.com	NORMAL	fp_6c89240985ea8279226289be0fb3cec3	6	24.36678448	88.61942729
00000001000000917	Md. Shamsul	01902055630	chowdhury@bdmail.net	NORMAL	fp_259d2d327c89fea4e7be3866d835456b	7	24.86393584	89.38595092
00000001000000918	Shirin Begum	01537740806	kamalhossain@hotmail.com	NORMAL	fp_47c9ee6be68fc01d80e9c48f3e8123bc	8	22.80919309	89.53346758
00000001000000919	Shima Begum	01555877122	karimmia@outlook.com	NORMAL	fp_56b4878cc07f6c06999bcdeb3a026e79	9	23.18213026	89.22011711
00000001000000920	Rina Jahan	01688409527	jamalkhan@hotmail.com	NORMAL	fp_d5c5c74fa69b0af8d3ab7c4edad7663c	10	24.91861455	91.85258516
00000001000000921	Md. Jabbar	01154630234	rahimislam@bdmail.net	NORMAL	fp_3ed41382c63f6afe54e166da82af3348	1	23.86480740	90.38035690
00000001000000922	Khadija Hossain	01447180484	rahimhossain@hotmail.com	NORMAL	fp_bf00e563576f0a773f95294772241a75	2	23.79934745	90.39478137
00000001000000923	Lutfur Sarker	01583167424	chowdhury@outlook.com	NORMAL	fp_80e463de6e334e708d88d2bc0aaa5641	3	23.99308566	90.43354658
00000001000000924	Ripa Begum	01315368132	rafiq14@gmail.com	NORMAL	fp_2d6e94b78f9929b536a689d409712a3c	4	22.33225942	91.75982827
00000001000000925	Abul Islam	01852796577	hasanislam@yahoo.com	NORMAL	fp_53529e4557e5c21e3db48dc5bc6720fd	5	22.31602609	91.82571050
00000001000000926	Nargis Begum	01404365631	shahana@hotmail.com	NORMAL	fp_6b2219dc3ab0283dbebe38f2f7ac9f5f	6	24.39299306	88.59394060
00000001000000927	Saleha Begum	01483830113	ahmed@outlook.com	NORMAL	fp_daba5afd541fee483a4245c2f368055f	7	24.87103476	89.37202749
00000001000000928	Rokeya Sultana	01410879862	sarker@outlook.com	NORMAL	fp_4c6bd362522a992cb42bbdb7be99ce43	8	22.83626364	89.53905878
00000001000000929	Shahrukh Rahman	01991333318	parvin@outlook.com	NORMAL	fp_e95af07401d73c028ef4e040128d09d1	9	23.18675738	89.22768615
00000001000000930	Rina Khatun	01701652832	shirin@bdmail.net	NORMAL	fp_48f4d7b1e00994cda7d96d6ef1664d3a	10	24.91306496	91.86632029
00000001000000931	Md. Shahed	01863279533	hasankhan@yahoo.com	NORMAL	fp_e7658c3c884700bc67cbe20a03a23243	1	23.89518769	90.38639362
00000001000000932	Nasrin Begum	01295890108	karim50@hotmail.com	NORMAL	fp_cd2471249a1d06562b558af57f792028	2	23.76593083	90.37398253
00000001000000933	Lutfur Ahmed	01477503439	khan@outlook.com	NORMAL	fp_eff5ffcb2664314def8408aea4c4441b	3	23.98840715	90.43570624
00000001000000934	Rokeya Begum	01424373012	shofiqhossain@hotmail.com	NORMAL	fp_a09f25a4e4db07994660618bd499870d	4	22.36319049	91.80704930
00000001000000935	Mir Haque	01245893439	ayesha@yahoo.com	NORMAL	fp_f086ea7d483e0c7634db2e58eb0d36f8	5	22.32973266	91.83455940
00000001000000936	Marium Rahman	01178108940	barkat63@hotmail.com	NORMAL	fp_bbc4b67c3aeee2bc891e43db2a0fd131	6	24.35829540	88.62326423
00000001000000937	Ms. Khan	01621247645	ahmed@bdmail.net	NORMAL	fp_30a588a4f52cbbc8bc8b91d73ceb7557	7	24.84053301	89.37902545
00000001000000938	Ruma Sultana	01266392635	jamal@hotmail.com	NORMAL	fp_0fd6a2e681364561c209205cadc40ce2	8	22.83562282	89.54412992
00000001000000939	Mir Islam	01759473932	salam@outlook.com	NORMAL	fp_f922e6b596244964fbf90690b531ff91	9	23.15923553	89.20106244
00000001000000940	Ms. Sultana	01918689567	karim@bdmail.net	NORMAL	fp_dcbfc1ecb33ad258ee7212a32c477e5d	10	24.91720127	91.84523576
00000001000000941	Md. Jamal	01482898697	shirin@gmail.com	NORMAL	fp_6929573769371969c94a3b8025cdeef2	1	23.88270852	90.38882000
00000001000000942	Md. Barkat	01173757477	sarker@outlook.com	NORMAL	fp_8cf80375ac02582026e4f4a264911483	2	23.78990449	90.36270232
00000001000000943	Md. Mizanur	01872726193	nasrin@outlook.com	NORMAL	fp_48c9567591dbe7d66b291108127efc47	3	23.99861752	90.39828521
00000001000000944	Mohammad Das	01606376409	rokeya@yahoo.com	NORMAL	fp_96eefbceeec864bdd96b7f03aa2f1af9	4	22.37608007	91.80088176
00000001000000945	Md. Shamsul	01816265226	karim@bdmail.net	NORMAL	fp_966b29474b66a80aae929bfe6f7e4405	5	22.35435135	91.81302512
00000001000000946	Shahnewaz Sarker	01313175774	rafiq@bdmail.net	NORMAL	fp_292ea5c15b6426168aaf44bf15fc1c4f	6	24.36214589	88.62840969
00000001000000947	Md. Jabbar	01299375558	nasrin@outlook.com	NORMAL	fp_f991fba73c1df00fb1abdf4040ca4bc9	7	24.84525649	89.38477121
00000001000000948	Farida Sultana	01620921079	khadija@outlook.com	NORMAL	fp_f5c3f43bab0dd7a4c4d305067566b2fa	8	22.80556501	89.55762052
00000001000000949	Rabeya Sultana	01955017281	salamdas@bdmail.net	NORMAL	fp_390851854d60858827fbedd3c85eb2c7	9	23.16470140	89.20326519
00000001000000950	Lima Hossain	01904769796	khadija@gmail.com	NORMAL	fp_4a854e545816cb55d9bb871d27dcbd14	10	24.90515793	91.89247828
00000001000000951	Shahnewaz Ali	01540389590	shofiq2@hotmail.com	NORMAL	fp_193ebc671fff5d06c799fca7c7aa0fbd	1	23.86139414	90.38977077
00000001000000952	Mina Rahman	01785932570	shofiq@yahoo.com	NORMAL	fp_2d47a277ee3aedebbec93b5e84cea775	2	23.80224923	90.37057225
00000001000000953	Shirin Sultana	01987398163	parvin@outlook.com	NORMAL	fp_296ae3ffe201fdb24e5964460dcb410d	3	24.01170636	90.44339504
00000001000000954	Abul Hossain	01733091877	chowdhury@bdmail.net	NORMAL	fp_a09a756b2af38a1e02c40954e0ad2872	4	22.37306481	91.77544942
00000001000000955	Nasrin Begum	01181489738	salam62@gmail.com	NORMAL	fp_b45948f9f5ed95344de4d94f68a7d01a	5	22.32895494	91.82444195
00000001000000956	Quazi Mia	01411258594	islam@outlook.com	NORMAL	fp_13809c462f38e2b6d16506a8af54c403	6	24.35425398	88.58959977
00000001000000957	Mir Khan	01985280640	fatema@hotmail.com	NORMAL	fp_3a7c56686f7a8345a4a77dad701d645a	7	24.85199532	89.38401245
00000001000000958	Abul Islam	01369274423	karim2@hotmail.com	NORMAL	fp_814e1f856fb1dbfde650151e205c5a47	8	22.82922986	89.55204686
00000001000000959	Nasima Khan	01449067057	rahman@yahoo.com	NORMAL	fp_c2bc2926ef1893271e3b472e7ae8558c	9	23.16565998	89.19343649
00000001000000960	Md. Jabbar	01770668674	das@outlook.com	NORMAL	fp_df7448fe5b8fb6b438cb4dbef108d04c	10	24.88405431	91.84722713
00000001000000961	Nasima Khan	01729736170	shahin@gmail.com	NORMAL	fp_43667bbbdec7157464545c0604feaa9f	1	23.89713726	90.37134358
00000001000000962	Mohammad Khan	01891091670	shofiqahmed@gmail.com	NORMAL	fp_e4c4deb5a304e4c3842a520ce6b025cc	2	23.80002714	90.40215370
00000001000000963	Shahnaz Rahman	01536827310	hasanrahman@outlook.com	NORMAL	fp_afae115b9daac8d1a6dab1e24154b4e2	3	24.01014101	90.44200000
00000001000000964	Shah Alam	01948933564	chowdhury@outlook.com	NORMAL	fp_07544d826a58d75f7fb82c25b42b4122	4	22.36362529	91.80334604
00000001000000965	Rabeya Akter	01595023348	ahmed@gmail.com	NORMAL	fp_4e423dd968a460881a0234cc97f2fe3b	5	22.31765595	91.81092386
00000001000000966	Md. Shamsul	01353430554	hossain@hotmail.com	NORMAL	fp_bb730ab49ccc6be394890f43db0127eb	6	24.35187902	88.61682800
00000001000000967	Shahriar Ali	01825992726	rokeya@hotmail.com	NORMAL	fp_857e4c13797fb4a1a7248ac3314923fb	7	24.82652075	89.36031200
00000001000000968	Khadija Hossain	01982586991	rabeya@yahoo.com	NORMAL	fp_8490205b25d50910952e5f95cddc52e7	8	22.80966990	89.53788811
00000001000000969	Rabeya Sultana	01856589432	rafiqkhan@outlook.com	NORMAL	fp_534a626f9f62a578b0de5381458348c6	9	23.17032886	89.20758181
00000001000000970	Nasima Chowdhury	01141503037	shofiqahmed@yahoo.com	NORMAL	fp_cfaf4448aaad00cf4ed3a58937dac205	10	24.90348749	91.87340327
00000001000000972	Fatema Begum	01569880069	chowdhury@hotmail.com	NORMAL	fp_47ea40d67d9cc039e3579cbb9a4e2cbe	2	23.78419432	90.37710669
00000001000000973	Mir Hossain	01211751746	kamal@gmail.com	NORMAL	fp_b3046a46bd20117e5b12bd91b1bb561e	3	23.99039761	90.40123520
00000001000000974	Morjina Khan	01895038784	jamalhossain@outlook.com	NORMAL	fp_32fb55e543a259ba42dcbb1489d245ad	4	22.37247303	91.79211850
00000001000000975	Gias Islam	01573617843	das@outlook.com	NORMAL	fp_67c222d80310d6b523654076d3a023bd	5	22.32909739	91.83092230
00000001000000976	Ms. Begum	01738535657	chowdhury@hotmail.com	NORMAL	fp_fdd9150e657cb82206b4e9d4cd1b338a	6	24.35789718	88.61385441
00000001000000977	Mina Jahan	01939063885	shofiq@yahoo.com	NORMAL	fp_facb26defeec1c634a5c02cdb3b7d8dc	7	24.84036029	89.37270420
00000001000000978	Fatema Begum	01802705563	fatema@bdmail.net	NORMAL	fp_b945d3fc91bab72105663c56914141fa	8	22.79236395	89.53502737
00000001000000979	Mrs. Khan	01413682879	barkat@hotmail.com	NORMAL	fp_8411f9d805987da45503ab806d6fafed	9	23.17964195	89.18411243
00000001000000980	Ahmed Chowdhury	01470017514	shahana@yahoo.com	NORMAL	fp_cbb497f6264418b6e5f133788a9f34ce	10	24.88282518	91.87616347
00000001000000981	Nur Ali	01408077061	salamdas@gmail.com	NORMAL	fp_44f466210fe9bfbe28cd4945896b1b51	1	23.87768491	90.38113504
00000001000000982	Rabeya Hossain	01191331334	ali@bdmail.net	NORMAL	fp_10bdd738413fb9c8a9223093516be7ba	2	23.75640029	90.37602371
00000001000000983	Mir Ali	01456799704	rabeya@bdmail.net	NORMAL	fp_b836cc1d3ce9dcf3257b274e819f89f8	3	23.99468575	90.41674474
00000001000000984	Muhammad Khan	01440834974	ayesha@yahoo.com	NORMAL	fp_0b53a24f4cdab6fa65183b75153f7048	4	22.34530237	91.79054650
00000001000000985	Shamima Hossain	01151660719	shofiqkhan@outlook.com	NORMAL	fp_22d9740effca812cf2f8b1ab219bb335	5	22.31686576	91.85568027
00000001000000986	Nargis Begum	01921192079	salam14@bdmail.net	NORMAL	fp_6226b43aa014b8404e4d8de54feeb15a	6	24.35198375	88.58032746
00000001000000987	Md. Jamal	01826769064	barkat87@gmail.com	NORMAL	fp_8fb3593f626ba6655a8d9ed67afde00d	7	24.84635799	89.36900450
00000001000000988	Shahnewaz Mia	01245817926	rafiq@hotmail.com	NORMAL	fp_812295a791e552fc8ea93d48b53dcde6	8	22.83325913	89.53263683
00000001000000989	Rina Khan	01316157403	rafiq25@bdmail.net	NORMAL	fp_1124c59d5f247b24ca8b74fde2605500	9	23.16312035	89.18814395
00000001000000990	Md. Barkat	01268866370	salam@yahoo.com	NORMAL	fp_77835ddc0fd64c10bde96aeebc2f7bdb	10	24.91411966	91.87733017
00000001000000991	Shahnewaz Khan	01393156301	hasanchowdhury@outlook.com	NORMAL	fp_33ceb063009229b7183de4a1c09a4e4e	1	23.86521095	90.40015771
00000001000000992	Shirin Begum	01407335652	jamalsarker@yahoo.com	NORMAL	fp_659d3d27216155e2ec35947c4e4a151e	2	23.77624399	90.38136190
00000001000000993	Shahriar Khan	01617461941	salammia@yahoo.com	NORMAL	fp_c8f5d103d63e4924ebd896689794f203	3	24.00954137	90.42603475
00000001000000994	Chowdhury Haque	01951531536	salam@yahoo.com	NORMAL	fp_b3f614939e2f6f17d783da7b5a1f33ed	4	22.33211459	91.77294089
00000001000000995	Quazi Haque	01543115179	rokeya@hotmail.com	NORMAL	fp_9409e00a99d31fcc3c28a609d91e0a2c	5	22.32158217	91.85696566
00000001000000996	Shirin Khan	01397130005	shofiq@hotmail.com	NORMAL	fp_3f33ac5210068029a4cb0a4a3de5ec64	6	24.35880755	88.58011133
00000001000000997	Shah Ali	01601299656	shofiq42@yahoo.com	NORMAL	fp_60fe52a43a15ef6d6ffaea047549200f	7	24.85192965	89.36816023
00000001000000998	Md. Jabbar	01738683229	shofiqdas@outlook.com	NORMAL	fp_e4488edde77b513dd84e081502d4630e	8	22.84025270	89.57320823
00000001000000999	Shahnaz Islam	01244393087	shahinislam@outlook.com	NORMAL	fp_c3f54b7b9e6f346ababec437b9c2e57e	9	23.18151474	89.22732668
00000001000001000	Syed Sarker	01216993194	rafiq@outlook.com	NORMAL	fp_6db53d7f2594cf3f128bc9cc617c67d1	10	24.90154969	91.87856538
1993456789012	kjhg	01717559922	gjfcdf@gmail.com	NORMAL	\N	5	23.81030000	90.41250000
1993456789011	lgyufyuvv	01717559922	voter@example.com	NORMAL	b2b924cb748a3fe8faa9891c4d5b28275b9d8f8ec2f59ea2b3c1bf4ac53e8cf9	10	23.81030000	90.41250000
1993456789015	lgyufyu	01717559922	um@gmail.com	NORMAL	1fafb8257fb7d4166aa83a701cae38320c4d729b212ba246858a0e4ca2e17e00	6	23.81030000	90.41250000
1993456789014	kk	01717559928	kk@gmail.com	NORMAL	326f6bc11a351cfd7b67d9c9f530c5f8811a34a010fe5722f666cac8adce9685	12	23.81030000	90.41250000
2305088	Dola Kongkona	14253245243	dola@gmail.com	NORMAL	d37df1ac2c9cb3d200a7d080c31f01982346e2d766bbe48db5cb7e6b92c2fea0	1	23.80000000	90.10000000
2305080	Shreya	123122	shreya@gmail.com	NORMAL	b116ee9930b9b20a9d7e0a70a4f7653a341c9d429582af7ad89eb6263d83ea60	1	23.00000000	90.00000000
\.


--
-- Data for Name: voter_of_election; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.voter_of_election (id, nid, election_id, center_id, last_voted_at, last_otp_sent_at, assigned_by, assigned_at, booth_id) FROM stdin;
95	00000001000000401	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
731	00000001000000714	24	\N	\N	\N	1	2026-04-04 02:37:14.786023	\N
732	00000001000000294	24	\N	\N	\N	1	2026-04-04 02:37:14.971868	\N
733	00000001000000634	24	\N	\N	\N	1	2026-04-04 02:37:15.08222	\N
734	00000001000000174	24	\N	\N	\N	1	2026-04-04 02:37:15.189048	\N
270	00000001000000604	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
735	00000001000000954	24	\N	\N	\N	1	2026-04-04 02:37:15.294106	\N
736	00000001000000544	24	\N	\N	\N	1	2026-04-04 02:37:15.399927	\N
737	00000001000000204	24	\N	\N	\N	1	2026-04-04 02:37:15.507536	\N
738	00000001000000994	24	\N	\N	\N	1	2026-04-04 02:37:15.617635	\N
739	00000001000000244	24	\N	\N	\N	1	2026-04-04 02:37:15.724988	\N
740	00000001000000864	24	\N	\N	\N	1	2026-04-04 02:37:15.838675	\N
741	00000001000000624	24	\N	\N	\N	1	2026-04-04 02:37:15.948293	\N
271	00000001000000724	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
742	00000001000000604	24	\N	\N	\N	1	2026-04-04 02:37:16.057411	\N
743	00000001000000354	24	\N	\N	\N	1	2026-04-04 02:37:16.173032	\N
744	00000001000000264	24	\N	\N	\N	1	2026-04-04 02:37:16.277937	\N
323	00000001000000637	4	14	\N	\N	\N	2026-03-24 20:57:48.657	\N
272	00000001000000094	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
102	00000001000000631	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
103	00000001000000431	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
104	00000001000000061	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
105	00000001000000731	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
106	00000001000000701	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
107	00000001000000501	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
108	00000001000000751	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
109	00000001000000171	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
110	00000001000000841	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
111	00000001000000651	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
112	00000001000000881	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
113	00000001000000041	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
114	00000001000000231	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
115	00000001000000101	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
116	00000001000000141	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
117	00000001000000791	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
118	00000001000000331	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
119	00000001000000251	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
120	00000001000000091	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
121	00000001000000561	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
122	00000001000000181	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
123	00000001000000241	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
124	00000001000000951	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
125	00000001000000271	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
126	00000001000000811	2	1	\N	\N	\N	2026-03-18 00:32:41.142	\N
273	00000001000000864	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
745	00000001000000844	24	\N	\N	\N	1	2026-04-04 02:37:16.384791	\N
746	00000001000000104	24	\N	\N	\N	1	2026-04-04 02:37:16.492154	\N
274	00000001000000294	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
275	00000001000000134	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
276	00000001000000104	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
277	00000001000000764	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
278	00000001000000784	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
279	00000001000000534	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
280	00000001000000944	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
281	00000001000000804	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
282	00000001000000674	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
283	00000001000000124	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
284	00000001000000464	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
285	00000001000000884	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
286	00000001000000774	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
287	00000001000000284	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
288	00000001000000654	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
289	00000001000000194	1	8	\N	\N	\N	2026-03-18 21:11:44.035	\N
290	00000001000000974	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
291	00000001000000504	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
292	00000001000000234	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
293	00000001000000754	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
294	00000001000000494	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
295	00000001000000334	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
296	00000001000000564	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
297	00000001000000554	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
298	00000001000000584	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
299	00000001000000004	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
300	00000001000000154	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
301	00000001000000644	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
302	00000001000000144	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
303	00000001000000414	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
304	00000001000000684	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
305	00000001000000904	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
324	00000001000000707	4	14	\N	\N	\N	2026-03-24 20:57:48.657	\N
307	00000001000000344	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
308	00000001000000734	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
309	00000001000000374	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
310	00000001000000874	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
311	00000001000000424	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
312	00000001000000254	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
313	00000001000000214	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
314	00000001000000514	1	8	\N	\N	\N	2026-03-18 21:12:51.117	\N
325	00000001000000537	4	14	\N	\N	\N	2026-03-24 20:57:48.657	\N
326	00000001000000387	4	14	\N	\N	\N	2026-03-24 20:57:48.657	\N
327	00000001000000167	4	14	\N	\N	\N	2026-03-24 20:57:48.657	\N
47	00000001000000311	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
747	00000001000000564	24	\N	\N	\N	1	2026-04-04 02:37:16.599851	\N
748	00000001000000434	24	\N	\N	\N	1	2026-04-04 02:37:16.710911	\N
50	00000001000000801	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
55	00000001000000571	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
60	00000001000000641	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
64	00000001000000381	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
67	00000001000000741	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
749	00000001000000894	24	\N	\N	\N	1	2026-04-04 02:37:16.848477	\N
750	00000001000000644	24	\N	\N	\N	1	2026-04-04 02:37:16.954468	\N
751	00000001000000554	24	\N	\N	\N	1	2026-04-04 02:37:17.063084	\N
752	00000001000000314	24	\N	\N	\N	1	2026-04-04 02:37:17.17199	\N
753	00000001000000084	24	\N	\N	\N	1	2026-04-04 02:37:17.293254	\N
754	00000001000000524	24	\N	\N	\N	1	2026-04-04 02:37:17.3983	\N
755	00000001000000114	24	\N	\N	\N	1	2026-04-04 02:37:17.504844	\N
70	00000001000000191	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
72	00000001000000451	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
73	00000001000000831	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
75	00000001000000001	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
87	00000001000000211	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
88	00000001000000351	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
89	00000001000000441	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
90	00000001000000461	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
92	00000001000000011	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
93	00000001000000261	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
94	00000001000000931	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
96	00000001000000961	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
97	00000001000000521	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
99	00000001000000771	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
756	00000001000000764	24	\N	\N	\N	1	2026-04-04 02:37:17.608405	\N
131	00000001000000291	2	2	\N	\N	\N	2026-03-18 00:40:43.711	6
132	00000001000000541	2	2	\N	\N	\N	2026-03-18 00:40:43.711	1
757	00000001000000214	24	\N	\N	\N	1	2026-04-04 02:37:17.751853	\N
100	00000001000000391	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
318	00000001000000277	4	13	\N	\N	\N	2026-03-24 20:57:34.022	9
319	00000001000000987	4	13	\N	\N	\N	2026-03-24 20:57:34.022	10
320	00000001000000997	4	13	\N	\N	\N	2026-03-24 20:57:34.022	9
321	00000001000000887	4	13	\N	\N	\N	2026-03-24 20:57:34.022	10
322	00000001000000667	4	13	\N	\N	\N	2026-03-24 20:57:34.022	9
758	00000001000000454	24	\N	\N	\N	1	2026-04-04 02:37:17.862566	\N
759	00000001000000614	24	\N	\N	\N	1	2026-04-04 02:37:17.965834	\N
760	00000001000000664	24	\N	\N	\N	1	2026-04-04 02:37:18.076354	\N
761	00000001000000034	24	\N	\N	\N	1	2026-04-04 02:37:18.187912	\N
762	00000001000000144	24	\N	\N	\N	1	2026-04-04 02:37:18.291351	\N
763	00000001000000574	24	\N	\N	\N	1	2026-04-04 02:37:18.400823	\N
764	00000001000000124	24	\N	\N	\N	1	2026-04-04 02:37:18.516395	\N
765	00000001000000064	24	\N	\N	\N	1	2026-04-04 02:37:18.623875	\N
766	00000001000000944	24	\N	\N	\N	1	2026-04-04 02:37:18.734531	\N
767	00000001000000464	24	\N	\N	\N	1	2026-04-04 02:37:18.842735	\N
768	00000001000000974	24	\N	\N	\N	1	2026-04-04 02:37:18.954391	\N
769	00000001000000484	24	\N	\N	\N	1	2026-04-04 02:37:19.065299	\N
770	00000001000000344	24	\N	\N	\N	1	2026-04-04 02:37:19.176596	\N
371	00000001000000294	2	8	\N	\N	\N	2026-03-25 19:06:40.47	\N
372	00000001000000204	2	8	\N	\N	\N	2026-03-25 19:06:40.47	\N
771	00000001000000824	24	\N	\N	\N	1	2026-04-04 02:37:19.284427	\N
772	00000001000000394	24	\N	\N	\N	1	2026-04-04 02:37:19.390959	\N
773	00000001000000984	24	\N	\N	\N	1	2026-04-04 02:37:19.494935	\N
774	00000001000000504	24	\N	\N	\N	1	2026-04-04 02:37:19.603611	\N
775	00000001000000284	24	\N	\N	\N	1	2026-04-04 02:37:19.713055	\N
776	00000001000000184	24	\N	\N	\N	1	2026-04-04 02:37:19.861943	\N
777	00000001000000834	24	\N	\N	\N	1	2026-04-04 02:37:20.051256	\N
778	00000001000000024	24	\N	\N	\N	1	2026-04-04 02:37:20.157361	\N
779	00000001000000414	24	\N	\N	\N	1	2026-04-04 02:37:20.262996	\N
780	00000001000000254	24	\N	\N	\N	1	2026-04-04 02:37:20.368215	\N
781	00000001000000154	24	\N	\N	\N	1	2026-04-04 02:37:20.475728	\N
782	00000001000000004	24	\N	\N	\N	1	2026-04-04 02:37:20.585262	\N
783	00000001000000324	24	\N	\N	\N	1	2026-04-04 02:37:20.69569	\N
784	00000001000000914	24	\N	\N	\N	1	2026-04-04 02:37:20.801219	\N
785	00000001000000054	24	\N	\N	\N	1	2026-04-04 02:37:20.905872	\N
786	00000001000000884	24	\N	\N	\N	1	2026-04-04 02:37:21.009471	\N
787	00000001000000804	24	\N	\N	\N	1	2026-04-04 02:37:21.113965	\N
788	00000001000000794	24	\N	\N	\N	1	2026-04-04 02:37:21.217288	\N
789	00000001000000194	24	\N	\N	\N	1	2026-04-04 02:37:21.324575	\N
790	00000001000000734	24	\N	\N	\N	1	2026-04-04 02:37:21.43203	\N
791	00000001000000494	24	\N	\N	\N	1	2026-04-04 02:37:21.540164	\N
792	00000001000000724	24	\N	\N	\N	1	2026-04-04 02:37:21.645848	\N
793	00000001000000304	24	\N	\N	\N	1	2026-04-04 02:37:21.762103	\N
794	00000001000000924	24	\N	\N	\N	1	2026-04-04 02:37:21.873608	\N
795	00000001000000164	24	\N	\N	\N	1	2026-04-04 02:37:21.983638	\N
796	00000001000000934	24	\N	\N	\N	1	2026-04-04 02:37:22.095906	\N
361	00000001000000624	2	7	\N	\N	\N	2026-03-25 19:06:33.99	13
362	00000001000000714	2	7	\N	\N	\N	2026-03-25 19:06:33.99	13
363	00000001000000314	2	7	\N	\N	\N	2026-03-25 19:06:33.99	13
364	00000001000000434	2	7	\N	\N	\N	2026-03-25 19:06:33.99	13
365	00000001000000794	2	7	\N	\N	\N	2026-03-25 19:06:33.99	13
366	00000001000000914	2	7	\N	\N	\N	2026-03-25 19:06:33.99	13
367	00000001000000634	2	7	\N	\N	\N	2026-03-25 19:06:33.99	13
368	00000001000000024	2	7	\N	\N	\N	2026-03-25 19:06:33.99	13
369	00000001000000834	2	7	\N	\N	\N	2026-03-25 19:06:33.99	13
370	00000001000000454	2	7	\N	\N	\N	2026-03-25 19:06:33.99	13
268	00000001000000634	1	7	\N	\N	\N	2026-03-18 18:15:25.762	11
269	00000001000000244	1	7	\N	\N	\N	2026-03-18 18:15:25.762	11
797	00000001000000444	24	\N	\N	\N	1	2026-04-04 02:37:22.202311	\N
798	00000001000000364	24	\N	\N	\N	1	2026-04-04 02:37:22.314654	\N
26	00000001000000131	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
41	00000001000000661	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
799	00000001000000014	24	\N	\N	\N	1	2026-04-04 02:37:22.439788	\N
800	00000001000000704	24	\N	\N	\N	1	2026-04-04 02:37:22.543162	\N
801	00000001000000094	24	\N	\N	\N	1	2026-04-04 02:37:22.646968	\N
802	00000001000000964	24	\N	\N	\N	1	2026-04-04 02:37:22.75154	\N
803	00000001000000274	24	\N	\N	\N	1	2026-04-04 02:37:22.857105	\N
804	00000001000000474	24	\N	\N	\N	1	2026-04-04 02:37:22.96204	\N
805	00000001000000334	24	\N	\N	\N	1	2026-04-04 02:37:23.064696	\N
806	00000001000000224	24	\N	\N	\N	1	2026-04-04 02:37:23.176462	\N
807	00000001000000074	24	\N	\N	\N	1	2026-04-04 02:37:23.284131	\N
808	00000001000000814	24	\N	\N	\N	1	2026-04-04 02:37:23.392556	\N
809	00000001000000134	24	\N	\N	\N	1	2026-04-04 02:37:23.501177	\N
810	00000001000000234	24	\N	\N	\N	1	2026-04-04 02:37:23.604228	\N
811	00000001000000534	24	\N	\N	\N	1	2026-04-04 02:37:23.728709	\N
812	00000001000000784	24	\N	\N	\N	1	2026-04-04 02:37:23.839847	\N
813	00000001000000384	24	\N	\N	\N	1	2026-04-04 02:37:23.943511	\N
814	00000001000000594	24	\N	\N	\N	1	2026-04-04 02:37:24.046034	\N
815	00000001000000874	24	\N	\N	\N	1	2026-04-04 02:37:24.149938	\N
816	00000001000000684	24	\N	\N	\N	1	2026-04-04 02:37:24.255464	\N
817	00000001000000514	24	\N	\N	\N	1	2026-04-04 02:37:24.383742	\N
818	00000001000000744	24	\N	\N	\N	1	2026-04-04 02:37:24.504349	\N
819	00000001000000854	24	\N	\N	\N	1	2026-04-04 02:37:24.612428	\N
820	00000001000000374	24	\N	\N	\N	1	2026-04-04 02:37:24.717012	\N
821	00000001000000584	24	\N	\N	\N	1	2026-04-04 02:37:24.826374	\N
822	00000001000000424	24	\N	\N	\N	1	2026-04-04 02:37:24.936098	\N
823	00000001000000904	24	\N	\N	\N	1	2026-04-04 02:37:25.041151	\N
824	00000001000000694	24	\N	\N	\N	1	2026-04-04 02:37:25.145132	\N
825	00000001000000044	24	\N	\N	\N	1	2026-04-04 02:37:25.250658	\N
826	00000001000000674	24	\N	\N	\N	1	2026-04-04 02:37:25.355426	\N
827	00000001000000404	24	\N	\N	\N	1	2026-04-04 02:37:25.464368	\N
828	00000001000000654	24	\N	\N	\N	1	2026-04-04 02:37:25.579445	\N
829	00000001000000754	24	\N	\N	\N	1	2026-04-04 02:37:25.68975	\N
830	00000001000000774	24	\N	\N	\N	1	2026-04-04 02:37:25.794571	\N
351	00000001000000382	2	4	\N	\N	\N	2026-03-25 15:59:27.009	\N
352	00000001000000132	2	4	\N	\N	\N	2026-03-25 15:59:27.009	\N
353	00000001000000782	2	4	\N	\N	\N	2026-03-25 15:59:27.009	\N
354	00000001000000472	2	4	\N	\N	\N	2026-03-25 15:59:27.009	\N
355	00000001000000842	2	4	\N	\N	\N	2026-03-25 15:59:27.009	\N
356	00000001000000202	2	4	\N	\N	\N	2026-03-25 15:59:27.009	\N
968	00000001000000311	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
972	00000001000000241	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
973	00000001000000121	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
337	00000001000000642	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
338	00000001000000622	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
339	00000001000000062	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
340	00000001000000822	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
341	00000001000000512	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
342	00000001000000692	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
343	00000001000000112	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
344	00000001000000762	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
345	00000001000000742	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
346	00000001000000042	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
347	00000001000000982	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
348	00000001000000602	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
349	00000001000000852	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
350	00000001000000092	2	3	\N	\N	\N	2026-03-25 15:59:16.525	12
373	00000001000000174	1	\N	\N	\N	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	2026-03-27 13:40:18.548918	\N
374	00000001000000954	1	\N	\N	\N	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	2026-03-27 13:40:53.786904	\N
375	00000001000000204	1	\N	\N	\N	MDAmQYH22EWHb9sjsXsiWWkLWdMuoPvx	2026-03-27 18:39:04.252317	\N
244	00000001000000624	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
245	00000001000000714	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
246	00000001000000314	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
247	00000001000000434	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
248	00000001000000794	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
249	00000001000000914	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
251	00000001000000024	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
252	00000001000000834	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
253	00000001000000454	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
254	00000001000000224	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
255	00000001000000934	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
256	00000001000000044	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
257	00000001000000524	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
258	00000001000000444	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
259	00000001000000594	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
260	00000001000000544	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
261	00000001000000964	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
263	00000001000000034	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
264	00000001000000474	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
265	00000001000000984	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
266	00000001000000844	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
267	00000001000000354	1	7	\N	\N	\N	2026-03-18 18:15:12.312	11
974	00000001000000501	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
975	00000001000000631	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
976	00000001000000861	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
977	00000001000000751	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
980	00000001000000131	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
982	00000001000000811	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
983	00000001000000511	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
988	00000001000000801	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1271	00000001000000225	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1272	00000001000000625	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1273	00000001000000265	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1275	00000001000000865	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1276	00000001000000695	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1277	00000001000000795	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
32	00000001000000921	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
36	00000001000000621	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
56	00000001000000611	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
71	00000001000000941	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
29	00000001000000601	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
831	00000001000000425	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
833	00000001000000325	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
835	00000001000000165	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
837	00000001000000805	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
839	00000001000000545	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
840	00000001000000905	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
845	00000001000000595	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
847	00000001000000915	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
848	00000001000000855	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
849	00000001000000895	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
851	00000001000000605	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
854	00000001000000615	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
856	00000001000000575	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
857	00000001000000105	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
858	00000001000000315	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
859	00000001000000945	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
865	00000001000000115	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
869	00000001000000055	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
990	00000001000000341	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
992	00000001000000591	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
994	00000001000000731	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1000	00000001000000481	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1002	00000001000000471	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1005	00000001000000681	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1007	00000001000000791	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1008	00000001000000021	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1009	00000001000000091	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1012	00000001000000251	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1014	00000001000000181	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1017	00000001000000951	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1018	00000001000000991	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1022	00000001000000291	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1023	00000001000000651	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1024	00000001000000141	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1025	00000001000000231	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1027	00000001000000271	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
1278	00000001000000995	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1279	00000001000000965	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1280	00000001000000685	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1283	00000001000000875	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1285	00000001000000765	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1286	00000001000000285	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1288	00000001000000085	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1289	00000001000000565	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1290	00000001000000345	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1291	00000001000000005	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1292	00000001000000375	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1293	00000001000000775	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1294	00000001000000305	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1295	00000001000000355	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1296	00000001000000815	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1297	00000001000000175	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1298	00000001000000015	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
27	00000001000000481	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
28	00000001000000681	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
30	00000001000000511	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
34	00000001000000161	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
37	00000001000000991	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
39	00000001000000591	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
40	00000001000000861	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
42	00000001000000021	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
43	00000001000000121	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
44	00000001000000111	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
48	00000001000000341	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
49	00000001000000471	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
52	00000001000000581	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
54	00000001000000781	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
57	00000001000000821	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
58	00000001000000981	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
61	00000001000000321	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
63	00000001000000491	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
65	00000001000000891	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
66	00000001000000031	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
68	00000001000000361	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
69	00000001000000301	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
74	00000001000000421	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
76	00000001000000761	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
77	00000001000000221	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
78	00000001000000151	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
80	00000001000000721	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
81	00000001000000691	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
82	00000001000000901	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
83	00000001000000711	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
84	00000001000000071	2	2	\N	\N	\N	2026-03-18 00:23:36.582	1
85	00000001000000671	2	2	\N	\N	\N	2026-03-18 00:23:36.582	5
86	00000001000000081	2	2	\N	\N	\N	2026-03-18 00:23:36.582	6
872	00000001000000255	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
873	00000001000000135	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
874	00000001000000225	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
876	00000001000000625	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
878	00000001000000675	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
880	00000001000000795	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
881	00000001000000995	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
882	00000001000000965	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
884	00000001000000045	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
885	00000001000000125	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
886	00000001000000875	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
887	00000001000000835	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
889	00000001000000285	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
892	00000001000000565	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
895	00000001000000775	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
898	00000001000000355	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
899	00000001000000815	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
900	00000001000000175	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
901	00000001000000015	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
902	00000001000000785	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
903	00000001000000505	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
904	00000001000000655	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
905	00000001000000405	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
906	00000001000000485	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
908	00000001000000985	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
909	00000001000000845	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
931	00000001000000201	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
933	00000001000000051	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
938	00000001000000851	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
940	00000001000000281	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
941	00000001000000871	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
943	00000001000000321	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
944	00000001000000301	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
948	00000001000000611	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
949	00000001000000581	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
950	00000001000000071	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
954	00000001000000941	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
955	00000001000000401	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
956	00000001000000711	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
961	00000001000000351	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
962	00000001000000781	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
964	00000001000000931	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
966	00000001000000761	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
969	00000001000000221	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
1029	00000001000000542	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1030	00000001000000772	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1031	00000001000000602	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1032	00000001000000382	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1033	00000001000000752	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1036	00000001000000042	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1037	00000001000000742	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1038	00000001000000272	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1040	00000001000000012	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1041	00000001000000312	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1042	00000001000000652	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1028	00000001000000532	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1034	00000001000000132	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1035	00000001000000372	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1039	00000001000000972	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1043	00000001000000782	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1044	00000001000000122	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1045	00000001000000922	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1046	00000001000000592	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1047	00000001000000872	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1048	00000001000000472	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1299	00000001000000785	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1301	00000001000000655	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
832	00000001000000925	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
834	00000001000000065	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
836	00000001000000975	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
838	00000001000000715	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
841	00000001000000735	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
842	00000001000000145	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
843	00000001000000585	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
844	00000001000000155	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
846	00000001000000535	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
850	00000001000000445	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
852	00000001000000295	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
853	00000001000000365	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
855	00000001000000245	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
860	00000001000000185	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
861	00000001000000195	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
862	00000001000000935	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
863	00000001000000495	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
864	00000001000000705	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
866	00000001000000475	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
867	00000001000000205	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
868	00000001000000215	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
870	00000001000000395	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
871	00000001000000955	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
875	00000001000000265	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
877	00000001000000865	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
879	00000001000000695	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
883	00000001000000685	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
888	00000001000000765	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
890	00000001000000465	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
891	00000001000000085	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
893	00000001000000345	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
894	00000001000000005	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
896	00000001000000375	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
897	00000001000000305	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
907	00000001000000075	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
917	00000001000000825	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
920	00000001000000275	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
922	00000001000000435	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
924	00000001000000635	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
925	00000001000000235	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
928	1993456789012	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
1302	00000001000000405	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1303	00000001000000485	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1304	00000001000000075	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1305	00000001000000985	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1306	00000001000000845	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1307	00000001000000665	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1309	00000001000000415	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1310	00000001000000035	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1312	00000001000000525	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1315	00000001000000825	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1316	00000001000000745	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1317	00000001000000275	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1318	00000001000000335	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1319	00000001000000435	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1321	00000001000000235	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
910	00000001000000665	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
911	00000001000000025	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
912	00000001000000415	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
913	00000001000000035	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
914	00000001000000525	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
915	00000001000000515	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
916	00000001000000455	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
918	00000001000000555	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
919	00000001000000745	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
921	00000001000000335	24	10	\N	\N	\N	2026-04-04 02:40:08.789	19
970	00000001000000891	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
971	00000001000000191	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
978	00000001000000961	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
979	00000001000000151	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
981	00000001000000821	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
984	00000001000000381	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
985	00000001000000981	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
633	00000001000000906	23	\N	\N	\N	1	2026-04-03 21:30:04.689114	\N
923	00000001000000885	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
926	00000001000000095	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
927	00000001000000385	24	10	\N	\N	\N	2026-04-04 02:40:16.345	19
986	00000001000000671	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
638	00000001000000486	23	\N	\N	\N	1	2026-04-03 21:30:05.71907	\N
987	00000001000000421	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
989	00000001000000901	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
641	00000001000000136	23	\N	\N	\N	1	2026-04-03 21:30:06.438907	\N
642	00000001000000266	23	\N	\N	\N	1	2026-04-03 21:30:06.6442	\N
991	00000001000000451	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
993	00000001000000031	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
995	00000001000000441	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
646	00000001000000656	23	\N	\N	\N	1	2026-04-03 21:30:07.466631	\N
996	00000001000000491	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
648	00000001000000036	23	\N	\N	\N	1	2026-04-03 21:30:07.881293	\N
997	00000001000000461	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
998	00000001000000081	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
651	00000001000000936	23	\N	\N	\N	1	2026-04-03 21:30:08.503869	\N
999	00000001000000741	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
1001	00000001000000721	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
654	00000001000000086	23	\N	\N	\N	1	2026-04-03 21:30:09.114329	\N
655	00000001000000496	23	\N	\N	\N	1	2026-04-03 21:30:09.319162	\N
1003	00000001000000001	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
657	00000001000000696	23	\N	\N	\N	1	2026-04-03 21:30:09.688434	\N
658	00000001000000826	23	\N	\N	\N	1	2026-04-03 21:30:09.941178	\N
1004	00000001000000691	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
660	00000001000000966	23	\N	\N	\N	1	2026-04-03 21:30:10.349062	\N
661	00000001000000666	23	\N	\N	\N	1	2026-04-03 21:30:10.549864	\N
662	00000001000000746	23	\N	\N	\N	1	2026-04-03 21:30:10.757245	\N
663	00000001000000046	23	\N	\N	\N	1	2026-04-03 21:30:10.961958	\N
664	00000001000000736	23	\N	\N	\N	1	2026-04-03 21:30:11.178737	\N
1011	00000001000000361	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
1013	00000001000000211	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
667	00000001000000976	23	\N	\N	\N	1	2026-04-03 21:30:11.78469	\N
668	00000001000000076	23	\N	\N	\N	1	2026-04-03 21:30:11.992343	\N
669	00000001000000186	23	\N	\N	\N	1	2026-04-03 21:30:12.197172	\N
1322	00000001000000635	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1323	00000001000000095	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1324	00000001000000385	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1325	1993456789012	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
681	00000001000000316	23	\N	\N	\N	1	2026-04-03 21:30:14.564693	\N
682	00000001000000956	23	\N	\N	\N	1	2026-04-03 21:30:14.803824	\N
683	00000001000000256	23	\N	\N	\N	1	2026-04-03 21:30:14.97458	\N
685	00000001000000866	23	\N	\N	\N	1	2026-04-03 21:30:15.387095	\N
686	00000001000000406	23	\N	\N	\N	1	2026-04-03 21:30:15.599471	\N
687	00000001000000366	23	\N	\N	\N	1	2026-04-03 21:30:15.801882	\N
688	00000001000000676	23	\N	\N	\N	1	2026-04-03 21:30:16.009478	\N
691	00000001000000836	23	\N	\N	\N	1	2026-04-03 21:30:16.624586	\N
692	00000001000000026	23	\N	\N	\N	1	2026-04-03 21:30:16.829578	\N
693	00000001000000016	23	\N	\N	\N	1	2026-04-03 21:30:17.025714	\N
695	00000001000000176	23	\N	\N	\N	1	2026-04-03 21:30:17.467331	\N
697	00000001000000626	23	\N	\N	\N	1	2026-04-03 21:30:17.95958	\N
698	00000001000000146	23	\N	\N	\N	1	2026-04-03 21:30:18.169605	\N
706	00000001000000946	23	\N	\N	\N	1	2026-04-03 21:30:19.798562	\N
1427	00000001000000201	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1429	00000001000000051	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
710	00000001000000066	23	\N	\N	\N	1	2026-04-03 21:30:20.737539	\N
711	00000001000000436	23	\N	\N	\N	1	2026-04-03 21:30:20.949146	\N
1434	00000001000000851	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
713	00000001000000766	23	\N	\N	\N	1	2026-04-03 21:30:21.365073	\N
1436	00000001000000281	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
715	00000001000000226	23	\N	\N	\N	1	2026-04-03 21:30:21.757186	\N
1437	00000001000000871	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1439	00000001000000321	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1440	00000001000000301	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
634	00000001000000116	23	12	\N	\N	1	2026-04-03 22:11:18.232	\N
1444	00000001000000611	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1524	2305088	25	1	\N	\N	\N	2026-04-04 10:36:29.777	20
1525	2305080	25	1	\N	\N	\N	2026-04-04 10:36:29.777	20
718	00000001000000396	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
672	00000001000000056	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
689	00000001000000336	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
714	00000001000000816	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
719	00000001000000546	23	\N	\N	\N	1	2026-04-03 21:30:22.585127	\N
1016	00000001000000641	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
1020	00000001000000541	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
722	00000001000000286	23	\N	\N	\N	1	2026-04-03 21:30:23.214491	\N
723	00000001000000476	23	\N	\N	\N	1	2026-04-03 21:30:23.417608	\N
724	00000001000000996	23	\N	\N	\N	1	2026-04-03 21:30:23.611356	\N
725	00000001000000426	23	\N	\N	\N	1	2026-04-03 21:30:23.815388	\N
726	00000001000000106	23	\N	\N	\N	1	2026-04-03 21:30:24.020908	\N
1021	00000001000000831	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
1026	00000001000000571	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
640	00000001000000646	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
1098	00000001000000832	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
635	00000001000000206	23	12	\N	\N	1	2026-04-03 22:11:18.232	\N
636	00000001000000196	23	12	\N	\N	1	2026-04-03 22:11:18.232	\N
637	00000001000000216	23	12	\N	\N	1	2026-04-03 22:11:18.232	\N
647	00000001000000876	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
1101	00000001000000282	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1102	00000001000000022	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1105	00000001000000502	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1107	00000001000000082	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1112	00000001000000622	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1115	00000001000000162	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1116	00000001000000862	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
644	00000001000000166	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
1118	00000001000000992	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
653	00000001000000386	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
659	00000001000000556	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
666	00000001000000616	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
1119	00000001000000512	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1120	00000001000000242	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1050	00000001000000942	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1052	00000001000000212	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1054	00000001000000682	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1055	00000001000000552	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1057	00000001000000812	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
639	00000001000000326	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
643	00000001000000916	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
645	00000001000000526	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
650	00000001000000416	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
675	00000001000000506	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
730	00000001000000926	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
1058	00000001000000612	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1059	00000001000000452	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1060	00000001000000462	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1062	00000001000000952	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1066	00000001000000962	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1067	00000001000000422	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1068	00000001000000202	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1445	00000001000000581	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1449	00000001000000391	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1450	00000001000000941	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1452	00000001000000711	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1457	00000001000000351	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1446	00000001000000071	26	1	\N	\N	1	2026-04-04 09:46:10.438	28
1451	00000001000000401	26	1	\N	\N	1	2026-04-04 09:46:10.438	27
708	00000001000000776	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
712	00000001000000446	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
716	00000001000000716	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
721	00000001000000356	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
728	00000001000000586	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
649	00000001000000706	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
652	00000001000000456	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
656	00000001000000536	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
665	00000001000000896	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
670	00000001000000296	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
671	00000001000000756	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
673	00000001000000516	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
674	00000001000000806	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
676	00000001000000346	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
677	00000001000000376	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
678	00000001000000156	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
679	00000001000000276	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
680	00000001000000686	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
684	00000001000000096	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
690	00000001000000466	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
694	00000001000000796	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
696	00000001000000006	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
699	00000001000000126	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
700	00000001000000606	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
701	00000001000000886	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
702	00000001000000246	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
703	00000001000000596	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
704	00000001000000306	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
705	00000001000000856	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
717	00000001000000566	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
720	00000001000000576	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
727	00000001000000726	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
707	00000001000000236	23	11	\N	\N	\N	2026-04-03 22:11:32.925	17
709	00000001000000786	23	11	\N	\N	\N	2026-04-03 22:11:32.925	16
1460	00000001000000931	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1462	00000001000000761	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1465	00000001000000221	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1466	00000001000000891	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1467	00000001000000191	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1130	00000001000000634	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1131	00000001000000174	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1132	00000001000000954	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1133	00000001000000544	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1134	00000001000000204	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1135	00000001000000994	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1136	00000001000000244	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1137	00000001000000864	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1138	00000001000000624	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1139	00000001000000604	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1140	00000001000000354	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1141	00000001000000264	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1142	00000001000000844	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1143	00000001000000104	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1144	00000001000000564	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
929	00000001000000411	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
930	00000001000000371	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
932	00000001000000061	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
934	00000001000000431	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
935	00000001000000911	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
936	00000001000000551	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
937	00000001000000881	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
939	00000001000000561	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
942	00000001000000531	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
945	00000001000000161	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
946	00000001000000661	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
947	00000001000000621	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
951	00000001000000701	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
952	00000001000000921	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
957	00000001000000841	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
958	00000001000000331	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
959	00000001000000101	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
960	00000001000000601	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
963	00000001000000111	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
965	00000001000000171	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
967	00000001000000041	25	1	\N	\N	\N	2026-04-04 06:08:45.228	20
953	00000001000000391	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
1006	00000001000000771	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
1010	00000001000000521	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
1015	00000001000000261	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
1019	00000001000000011	25	2	\N	\N	\N	2026-04-04 06:08:59.048	21
1049	00000001000000632	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1051	00000001000000642	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1053	00000001000000822	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1056	00000001000000072	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1061	00000001000000842	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1063	00000001000000892	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1064	00000001000000562	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1065	00000001000000712	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1069	00000001000000432	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1072	00000001000000802	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1073	00000001000000262	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1074	00000001000000852	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1075	00000001000000092	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1076	00000001000000792	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1077	00000001000000932	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1078	00000001000000662	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1083	00000001000000762	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1084	00000001000000112	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1085	00000001000000982	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1086	00000001000000062	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1087	00000001000000692	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1088	00000001000000332	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1090	00000001000000582	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1094	00000001000000412	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1097	00000001000000442	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1121	00000001000000702	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1123	00000001000000292	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1125	00000001000000172	25	3	\N	\N	\N	2026-04-04 06:16:07.423	22
1070	00000001000000392	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1071	00000001000000222	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1079	00000001000000572	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1080	00000001000000722	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1081	00000001000000192	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1082	00000001000000302	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1089	00000001000000352	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1091	00000001000000522	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1092	00000001000000182	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1104	00000001000000732	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1110	00000001000000882	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1093	00000001000000252	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1095	00000001000000672	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1096	00000001000000902	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1099	00000001000000142	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1100	00000001000000152	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1103	00000001000000002	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1106	00000001000000492	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1108	00000001000000032	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1109	00000001000000482	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1111	00000001000000402	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1113	00000001000000052	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1114	00000001000000322	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1117	00000001000000362	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1122	00000001000000912	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1124	00000001000000232	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1126	00000001000000342	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1127	00000001000000102	25	4	\N	\N	\N	2026-04-04 06:16:35.847	23
1474	00000001000000961	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1477	00000001000000821	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1475	00000001000000151	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1480	00000001000000381	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1481	00000001000000981	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1482	00000001000000671	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1483	00000001000000421	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1485	00000001000000901	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1487	00000001000000451	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1489	00000001000000031	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1491	00000001000000441	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1492	00000001000000491	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1493	00000001000000461	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1495	00000001000000741	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1494	00000001000000081	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1497	00000001000000721	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1128	00000001000000714	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1129	00000001000000294	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1374	00000001000000009	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1376	00000001000000149	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1378	00000001000000649	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1379	00000001000000379	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1381	00000001000000139	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1383	00000001000000079	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1384	00000001000000969	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1385	00000001000000949	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1386	00000001000000989	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1388	00000001000000529	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1389	00000001000000159	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1391	00000001000000369	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1392	00000001000000239	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1393	00000001000000229	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1394	00000001000000849	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1396	00000001000000359	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1400	00000001000000419	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1402	00000001000000589	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1403	00000001000000569	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1404	00000001000000189	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1406	00000001000000699	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1407	00000001000000429	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1408	00000001000000719	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1409	00000001000000049	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1411	00000001000000609	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1412	00000001000000889	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1414	00000001000000459	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1415	00000001000000299	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1416	00000001000000919	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1417	00000001000000129	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1418	00000001000000109	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1420	00000001000000909	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1422	00000001000000599	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1423	00000001000000409	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1424	00000001000000659	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1145	00000001000000434	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1146	00000001000000894	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1147	00000001000000644	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1148	00000001000000554	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1149	00000001000000314	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1150	00000001000000084	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1151	00000001000000524	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1152	00000001000000114	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1153	00000001000000764	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1154	00000001000000214	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1155	00000001000000454	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1156	00000001000000614	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1157	00000001000000664	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1158	00000001000000034	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1159	00000001000000144	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1160	00000001000000574	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1161	00000001000000124	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1162	00000001000000064	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1163	00000001000000944	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1164	00000001000000464	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1165	00000001000000484	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1166	00000001000000974	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1167	00000001000000344	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1168	00000001000000824	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1169	00000001000000394	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1170	00000001000000984	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1171	00000001000000504	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1172	00000001000000284	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1173	00000001000000184	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1174	00000001000000834	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1175	00000001000000024	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1176	00000001000000414	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1177	00000001000000154	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1178	00000001000000254	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1179	00000001000000004	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1180	00000001000000324	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1181	00000001000000914	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1182	00000001000000054	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1183	00000001000000884	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1184	00000001000000804	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1185	00000001000000794	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1186	00000001000000194	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1187	00000001000000734	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1188	00000001000000494	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1189	00000001000000724	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1190	00000001000000304	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1191	00000001000000924	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1192	00000001000000164	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1193	00000001000000934	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1194	00000001000000444	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1195	00000001000000364	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1196	00000001000000014	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1197	00000001000000704	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1198	00000001000000094	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1199	00000001000000964	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1200	00000001000000274	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1201	00000001000000334	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1202	00000001000000474	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1203	00000001000000224	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1204	00000001000000074	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1205	00000001000000814	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1206	00000001000000134	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1207	00000001000000234	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1208	00000001000000534	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1209	00000001000000784	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1210	00000001000000384	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1211	00000001000000594	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1212	00000001000000874	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1213	00000001000000684	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1214	00000001000000514	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1215	00000001000000744	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1216	00000001000000854	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1217	00000001000000374	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1218	00000001000000584	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1219	00000001000000424	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1220	00000001000000904	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1221	00000001000000044	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1222	00000001000000674	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1223	00000001000000694	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1224	00000001000000404	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1225	00000001000000654	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1226	00000001000000754	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1227	00000001000000774	25	7	\N	\N	\N	2026-04-04 07:18:44.937	24
1458	00000001000000781	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1499	00000001000000001	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1500	00000001000000691	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1502	00000001000000771	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1506	00000001000000521	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1507	00000001000000361	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1509	00000001000000211	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1511	00000001000000261	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1518	00000001000000291	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1234	00000001000000805	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1236	00000001000000545	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1242	00000001000000595	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1244	00000001000000915	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1245	00000001000000855	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1246	00000001000000895	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1250	00000001000000615	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1254	00000001000000105	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1255	00000001000000315	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1258	00000001000000185	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1262	00000001000000115	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1269	00000001000000255	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1270	00000001000000135	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1274	00000001000000675	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1281	00000001000000045	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1282	00000001000000125	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1284	00000001000000835	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1287	00000001000000465	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1300	00000001000000505	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1308	00000001000000025	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1311	00000001000000515	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1313	00000001000000455	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1314	00000001000000555	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1320	00000001000000885	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1428	00000001000000061	26	2	\N	\N	\N	2026-04-04 09:46:32.159	\N
1433	00000001000000881	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1430	00000001000000431	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1326	00000001000000039	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1327	00000001000000549	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1328	00000001000000789	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1329	00000001000000309	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1330	00000001000000059	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1331	00000001000000769	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1332	00000001000000899	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1333	00000001000000539	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1334	00000001000000069	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1335	00000001000000279	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1425	00000001000000411	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1426	00000001000000371	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1431	00000001000000911	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1432	00000001000000551	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1336	00000001000000879	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1337	00000001000000179	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1338	00000001000000869	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1339	00000001000000319	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1340	00000001000000479	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1341	00000001000000329	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1342	00000001000000859	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1343	00000001000000689	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1344	00000001000000819	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1345	00000001000000779	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1346	00000001000000639	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1347	00000001000000349	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1348	00000001000000509	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1349	00000001000000449	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1350	00000001000000799	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1351	00000001000000199	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1352	00000001000000519	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1512	00000001000000641	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1515	00000001000000011	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1516	00000001000000541	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1517	00000001000000831	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1522	00000001000000571	26	2	\N	\N	1	2026-04-04 09:46:32.159	\N
1435	00000001000000561	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1438	00000001000000531	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1441	00000001000000161	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1442	00000001000000661	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1443	00000001000000621	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1447	00000001000000701	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1448	00000001000000921	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1453	00000001000000841	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1454	00000001000000331	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1455	00000001000000101	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1456	00000001000000601	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1459	00000001000000111	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1461	00000001000000171	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1463	00000001000000041	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1464	00000001000000311	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1468	00000001000000241	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1469	00000001000000121	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1470	00000001000000501	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1471	00000001000000631	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1472	00000001000000861	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1473	00000001000000751	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1476	00000001000000131	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1478	00000001000000811	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1228	00000001000000425	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1229	00000001000000925	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1230	00000001000000065	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1231	00000001000000325	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1232	00000001000000165	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1233	00000001000000975	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1235	00000001000000715	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1237	00000001000000905	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1238	00000001000000735	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1239	00000001000000145	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1240	00000001000000585	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1241	00000001000000155	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1243	00000001000000535	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1247	00000001000000445	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1248	00000001000000605	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1249	00000001000000295	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1251	00000001000000365	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1252	00000001000000245	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1253	00000001000000575	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1256	00000001000000945	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1257	00000001000000195	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1259	00000001000000495	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1260	00000001000000935	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1261	00000001000000705	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1263	00000001000000475	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1264	00000001000000205	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1265	00000001000000215	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1266	00000001000000055	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1267	00000001000000395	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1268	00000001000000955	25	25	\N	\N	\N	2026-04-04 07:34:50.819	25
1353	00000001000000019	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1354	00000001000000709	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1355	00000001000000249	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1356	00000001000000619	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1357	00000001000000099	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1358	00000001000000669	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1359	00000001000000559	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1360	00000001000000939	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1361	00000001000000489	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1362	00000001000000119	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1363	00000001000000469	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1364	00000001000000979	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1365	00000001000000219	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1366	00000001000000269	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1367	00000001000000499	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1368	00000001000000089	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1369	00000001000000389	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1370	00000001000000959	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1371	00000001000000169	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1372	00000001000000259	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1373	00000001000000809	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1375	00000001000000289	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1377	00000001000000399	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1380	00000001000000839	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1382	00000001000000579	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1387	00000001000000029	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1390	00000001000000749	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1395	00000001000000629	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1397	00000001000000739	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1398	00000001000000679	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1399	00000001000000729	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1401	00000001000000759	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1405	00000001000000439	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1410	00000001000000999	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1413	00000001000000929	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1419	00000001000000339	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1421	00000001000000829	25	17	\N	\N	\N	2026-04-04 07:41:17.49	26
1479	00000001000000511	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1484	00000001000000801	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1486	00000001000000341	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1488	00000001000000591	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1490	00000001000000731	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1496	00000001000000481	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1498	00000001000000471	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1501	00000001000000681	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1503	00000001000000791	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1504	00000001000000021	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1505	00000001000000091	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1508	00000001000000251	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1510	00000001000000181	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1513	00000001000000951	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1514	00000001000000991	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1519	00000001000000651	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1520	00000001000000141	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
1521	00000001000000231	26	1	\N	\N	\N	2026-04-04 09:45:52.826	28
1523	00000001000000271	26	1	\N	\N	\N	2026-04-04 09:45:52.826	27
\.


--
-- Data for Name: voter_otp; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.voter_otp (otp_id, voter_of_election_id, issued_at, expires_at, otp_value, is_used, attempt_count) FROM stdin;
1	36	2026-03-24 13:31:13.940427	2026-03-24 13:36:13.940427	205505	f	0
2	36	2026-03-24 13:32:10.221318	2026-03-24 13:37:10.221318	399370	f	0
3	36	2026-03-24 14:39:00.347541	2026-03-24 14:44:00.347541	289556	f	0
4	36	2026-03-24 14:47:12.674922	2026-03-24 14:52:12.674922	695629	t	0
5	56	2026-03-24 18:01:10.82481	2026-03-24 18:06:10.82481	381608	t	0
6	318	2026-03-24 21:46:47.39131	2026-03-24 21:51:47.39131	969096	t	0
7	322	2026-03-24 21:50:06.621352	2026-03-24 21:55:06.621352	730906	t	0
8	320	2026-03-24 21:50:24.319277	2026-03-24 21:55:24.319277	738475	t	0
9	348	2026-03-25 18:11:09.905184	2026-03-25 18:16:09.905184	760464	t	0
10	346	2026-03-25 18:11:32.813741	2026-03-25 18:16:32.813741	884020	t	0
11	345	2026-03-25 18:11:45.303363	2026-03-25 18:16:45.303363	908254	t	0
12	337	2026-03-25 18:14:18.642101	2026-03-25 18:19:18.642101	798042	t	0
13	340	2026-03-25 18:14:36.100724	2026-03-25 18:19:36.100724	171205	t	0
14	349	2026-03-25 18:14:46.355639	2026-03-25 18:19:46.355639	651955	t	0
15	350	2026-03-25 18:14:57.293479	2026-03-25 18:19:57.293479	443721	t	0
16	344	2026-03-25 18:15:09.658119	2026-03-25 18:20:09.658119	243929	t	0
17	343	2026-03-25 18:15:18.905044	2026-03-25 18:20:18.905044	817838	t	0
18	347	2026-03-25 18:15:29.294834	2026-03-25 18:20:29.294834	465115	t	0
19	339	2026-03-25 18:15:40.573493	2026-03-25 18:20:40.573493	853522	t	0
20	342	2026-03-25 18:15:50.454544	2026-03-25 18:20:50.454544	408805	t	0
21	32	2026-03-25 18:17:04.54561	2026-03-25 18:22:04.54561	911095	t	1
22	71	2026-03-25 18:17:35.441837	2026-03-25 18:22:35.441837	607812	t	0
23	94	2026-03-25 18:17:50.943366	2026-03-25 18:22:50.943366	657634	t	0
24	77	2026-03-25 18:18:05.617097	2026-03-25 18:23:05.617097	334859	t	0
25	70	2026-03-25 18:18:13.588954	2026-03-25 18:23:13.588954	525259	t	0
26	43	2026-03-25 18:18:23.17739	2026-03-25 18:23:23.17739	432846	t	0
27	40	2026-03-25 18:18:32.692465	2026-03-25 18:23:32.692465	398612	t	0
28	26	2026-03-25 18:18:44.817527	2026-03-25 18:23:44.817527	852585	t	0
29	30	2026-03-25 18:18:55.31567	2026-03-25 18:23:55.31567	904431	t	0
30	64	2026-03-25 18:19:04.947774	2026-03-25 18:24:04.947774	586770	t	0
31	74	2026-03-25 18:19:17.580143	2026-03-25 18:24:17.580143	456007	t	0
32	48	2026-03-25 18:19:26.993618	2026-03-25 18:24:26.993618	921240	t	0
33	362	2026-03-25 19:32:36.947596	2026-03-25 19:37:36.947596	549438	t	0
34	367	2026-03-25 19:33:49.43421	2026-03-25 19:38:49.43421	113437	t	0
35	361	2026-03-25 19:34:02.690547	2026-03-25 19:39:02.690547	250481	t	0
36	364	2026-03-25 19:34:13.760361	2026-03-25 19:39:13.760361	311268	t	0
37	363	2026-03-25 19:34:24.542838	2026-03-25 19:39:24.542838	499917	t	0
38	370	2026-03-25 19:34:31.768686	2026-03-25 19:39:31.768686	440664	t	0
39	369	2026-03-25 19:34:40.05671	2026-03-25 19:39:40.05671	188498	t	0
40	368	2026-03-25 19:34:48.185553	2026-03-25 19:39:48.185553	242764	t	0
41	366	2026-03-25 19:34:56.040713	2026-03-25 19:39:56.040713	426822	t	0
42	365	2026-03-25 19:35:08.367546	2026-03-25 19:40:08.367546	134649	t	0
43	245	2026-04-01 18:25:24.489557	2026-04-01 18:30:24.489557	280813	t	0
44	268	2026-04-01 18:31:43.366937	2026-04-01 18:36:43.366937	660821	t	0
77	933	2026-04-04 06:59:48.654915	2026-04-04 07:04:48.654915	111792	t	0
45	639	2026-04-03 22:56:47.910133	2026-04-03 23:01:47.910133	290862	t	1
46	640	2026-04-03 22:57:05.032295	2026-04-03 23:02:05.032295	363966	t	0
47	644	2026-04-03 22:57:24.613372	2026-04-03 23:02:24.613372	414620	t	0
48	831	2026-04-04 02:45:27.916306	2026-04-04 02:50:27.916306	826352	t	0
49	832	2026-04-04 02:46:56.438969	2026-04-04 02:51:56.438969	253667	t	0
50	833	2026-04-04 02:47:45.981265	2026-04-04 02:52:45.981265	666965	f	0
51	834	2026-04-04 02:48:01.541887	2026-04-04 02:53:01.541887	123499	f	0
52	833	2026-04-04 02:48:25.830214	2026-04-04 02:53:25.830214	123406	t	0
53	834	2026-04-04 02:48:53.427999	2026-04-04 02:53:53.427999	334718	t	0
54	643	2026-04-04 05:57:32.993339	2026-04-04 06:02:32.993339	221915	t	1
55	929	2026-04-04 06:24:42.109158	2026-04-04 06:29:42.109158	179709	t	0
56	930	2026-04-04 06:24:58.884069	2026-04-04 06:29:58.884069	123998	t	0
57	932	2026-04-04 06:25:11.479482	2026-04-04 06:30:11.479482	689090	t	0
58	934	2026-04-04 06:25:24.069892	2026-04-04 06:30:24.069892	456091	t	0
59	935	2026-04-04 06:25:36.674202	2026-04-04 06:30:36.674202	446064	t	0
60	936	2026-04-04 06:25:48.359505	2026-04-04 06:30:48.359505	656861	t	0
61	937	2026-04-04 06:26:00.858878	2026-04-04 06:31:00.858878	604836	t	0
62	939	2026-04-04 06:26:14.368948	2026-04-04 06:31:14.368948	829099	t	0
63	942	2026-04-04 06:26:28.179183	2026-04-04 06:31:28.179183	486504	t	0
64	945	2026-04-04 06:26:45.284115	2026-04-04 06:31:45.284115	580558	t	0
65	946	2026-04-04 06:27:03.814488	2026-04-04 06:32:03.814488	824757	t	0
66	947	2026-04-04 06:27:17.589526	2026-04-04 06:32:17.589526	437150	t	0
67	951	2026-04-04 06:27:28.579429	2026-04-04 06:32:28.579429	120971	t	0
68	952	2026-04-04 06:27:39.8595	2026-04-04 06:32:39.8595	704212	t	0
69	957	2026-04-04 06:27:54.919528	2026-04-04 06:32:54.919528	953163	t	0
70	958	2026-04-04 06:28:05.669534	2026-04-04 06:33:05.669534	805113	t	0
71	959	2026-04-04 06:28:17.859504	2026-04-04 06:33:17.859504	951086	t	0
72	960	2026-04-04 06:28:31.159666	2026-04-04 06:33:31.159666	702173	t	0
73	963	2026-04-04 06:28:42.525011	2026-04-04 06:33:42.525011	239817	t	0
74	965	2026-04-04 06:28:55.354471	2026-04-04 06:33:55.354471	725205	t	0
75	967	2026-04-04 06:29:08.61462	2026-04-04 06:34:08.61462	187802	t	0
76	931	2026-04-04 06:30:04.588928	2026-04-04 06:35:04.588928	171987	t	0
78	938	2026-04-04 07:00:00.902745	2026-04-04 07:05:00.902745	527765	t	0
79	940	2026-04-04 07:00:11.304385	2026-04-04 07:05:11.304385	325548	t	0
80	941	2026-04-04 07:00:26.025808	2026-04-04 07:05:26.025808	129301	t	0
81	943	2026-04-04 07:00:38.924303	2026-04-04 07:05:38.924303	589722	t	0
82	944	2026-04-04 07:01:03.763378	2026-04-04 07:06:03.763378	868672	t	0
83	948	2026-04-04 07:02:12.68111	2026-04-04 07:07:12.68111	186599	t	0
84	949	2026-04-04 07:02:25.269394	2026-04-04 07:07:25.269394	984801	t	0
85	950	2026-04-04 07:02:37.520324	2026-04-04 07:07:37.520324	524253	t	0
86	953	2026-04-04 07:02:50.663253	2026-04-04 07:07:50.663253	165447	t	0
87	954	2026-04-04 07:03:02.682415	2026-04-04 07:08:02.682415	981393	t	0
88	1028	2026-04-04 07:08:53.744778	2026-04-04 07:13:53.744778	396603	t	0
89	1034	2026-04-04 07:09:12.709817	2026-04-04 07:14:12.709817	341371	t	0
90	1035	2026-04-04 07:09:25.614778	2026-04-04 07:14:25.614778	810981	t	0
91	1039	2026-04-04 07:09:39.054527	2026-04-04 07:14:39.054527	943516	t	0
92	1043	2026-04-04 07:09:59.284419	2026-04-04 07:14:59.284419	456114	t	0
93	1044	2026-04-04 07:10:11.87453	2026-04-04 07:15:11.87453	700238	t	0
94	1045	2026-04-04 07:10:23.409583	2026-04-04 07:15:23.409583	354354	t	0
95	1046	2026-04-04 07:10:42.35489	2026-04-04 07:15:42.35489	911817	t	0
96	1047	2026-04-04 07:10:59.275933	2026-04-04 07:15:59.275933	865047	t	0
97	1048	2026-04-04 07:11:12.274678	2026-04-04 07:16:12.274678	868287	t	0
98	1050	2026-04-04 07:11:37.116599	2026-04-04 07:16:37.116599	939463	t	0
99	1052	2026-04-04 07:11:50.565325	2026-04-04 07:16:50.565325	236170	t	0
100	1054	2026-04-04 07:12:02.974377	2026-04-04 07:17:02.974377	883009	t	0
101	1055	2026-04-04 07:12:14.754346	2026-04-04 07:17:14.754346	281679	t	0
102	1057	2026-04-04 07:12:36.666259	2026-04-04 07:17:36.666259	772927	t	0
103	1058	2026-04-04 07:12:50.764802	2026-04-04 07:17:50.764802	988219	t	0
104	1059	2026-04-04 07:13:02.264929	2026-04-04 07:18:02.264929	548475	t	0
105	1060	2026-04-04 07:13:16.084377	2026-04-04 07:18:16.084377	693210	t	0
106	1128	2026-04-04 07:24:45.870157	2026-04-04 07:29:45.870157	167284	t	0
107	1129	2026-04-04 07:25:57.509183	2026-04-04 07:30:57.509183	542492	t	0
108	1130	2026-04-04 07:26:10.930147	2026-04-04 07:31:10.930147	869041	t	0
109	1131	2026-04-04 07:26:21.405031	2026-04-04 07:31:21.405031	508601	t	0
110	1132	2026-04-04 07:26:32.129038	2026-04-04 07:31:32.129038	137749	t	0
111	1133	2026-04-04 07:26:41.760031	2026-04-04 07:31:41.760031	452112	t	0
112	1134	2026-04-04 07:26:54.769088	2026-04-04 07:31:54.769088	138293	t	0
113	1135	2026-04-04 07:27:05.208928	2026-04-04 07:32:05.208928	405745	t	0
114	1136	2026-04-04 07:27:17.200302	2026-04-04 07:32:17.200302	493355	t	0
115	1137	2026-04-04 07:27:28.349238	2026-04-04 07:32:28.349238	734246	t	0
116	1228	2026-04-04 07:36:47.346942	2026-04-04 07:41:47.346942	222883	t	0
117	1229	2026-04-04 07:36:58.254782	2026-04-04 07:41:58.254782	916614	t	0
118	1231	2026-04-04 07:37:10.846819	2026-04-04 07:42:10.846819	538700	t	0
119	1230	2026-04-04 07:37:21.906769	2026-04-04 07:42:21.906769	114059	t	0
120	1232	2026-04-04 07:37:32.022722	2026-04-04 07:42:32.022722	531790	t	0
121	1233	2026-04-04 07:37:43.346737	2026-04-04 07:42:43.346737	311539	t	0
122	1234	2026-04-04 07:37:53.546877	2026-04-04 07:42:53.546877	460168	t	0
123	1235	2026-04-04 07:38:04.714582	2026-04-04 07:43:04.714582	470389	t	0
124	1236	2026-04-04 07:38:14.555656	2026-04-04 07:43:14.555656	922093	t	0
125	1326	2026-04-04 07:44:14.247079	2026-04-04 07:49:14.247079	963662	t	0
126	1327	2026-04-04 07:44:24.136999	2026-04-04 07:49:24.136999	307240	t	0
127	1328	2026-04-04 07:44:34.686931	2026-04-04 07:49:34.686931	606438	t	0
128	1329	2026-04-04 07:44:47.257167	2026-04-04 07:49:47.257167	305300	t	0
129	1330	2026-04-04 07:44:57.486959	2026-04-04 07:49:57.486959	325604	t	0
130	1332	2026-04-04 07:45:07.447043	2026-04-04 07:50:07.447043	589214	t	0
131	1331	2026-04-04 07:45:19.406943	2026-04-04 07:50:19.406943	291653	t	0
132	1333	2026-04-04 07:45:30.156967	2026-04-04 07:50:30.156967	329805	t	0
133	1334	2026-04-04 07:45:40.017008	2026-04-04 07:50:40.017008	893042	t	0
134	1335	2026-04-04 07:45:52.595299	2026-04-04 07:50:52.595299	678151	t	0
135	1336	2026-04-04 07:46:13.027373	2026-04-04 07:51:13.027373	507671	t	0
136	1337	2026-04-04 07:46:23.515454	2026-04-04 07:51:23.515454	466378	t	0
137	1338	2026-04-04 07:46:34.375456	2026-04-04 07:51:34.375456	450354	t	0
138	1339	2026-04-04 07:46:45.547513	2026-04-04 07:51:45.547513	766473	t	0
139	1340	2026-04-04 07:46:56.355425	2026-04-04 07:51:56.355425	893498	t	0
140	1341	2026-04-04 07:47:05.507427	2026-04-04 07:52:05.507427	143958	t	0
141	1342	2026-04-04 07:47:16.277617	2026-04-04 07:52:16.277617	495643	t	0
142	1343	2026-04-04 07:47:25.427464	2026-04-04 07:52:25.427464	332658	t	0
143	1425	2026-04-04 09:54:13.293597	2026-04-04 09:59:13.293597	502538	t	0
144	1430	2026-04-04 09:55:40.420347	2026-04-04 10:00:40.420347	931832	t	0
145	1431	2026-04-04 09:55:50.227816	2026-04-04 10:00:50.227816	397785	t	0
146	1524	2026-04-04 10:42:26.572392	2026-04-04 10:47:26.572392	248063	t	0
\.


--
-- Data for Name: voter_participation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.voter_participation (participation_id, voter_id, session_id, token_id, otp_id, has_voted, verified_at) FROM stdin;
\.


--
-- Data for Name: voting_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.voting_log (id, voter_token, constituency_of_election_id, candidate_id, vote_time) FROM stdin;
1	4e44966b	1	5	2026-03-24 14:58:02.907431
2	f4e9f861	1	9	2026-03-24 18:02:03.344436
3	899a29d4	13	10	2026-03-24 21:48:08.818114
4	88d50b86	13	10	2026-03-24 21:50:18.592576
5	6b785b28	13	10	2026-03-24 21:50:47.776447
6	b4ef09ed	2	12	2026-03-25 18:11:27.082083
7	7e2e3a74	2	12	2026-03-25 18:11:42.839208
8	abde8b51	2	14	2026-03-25 18:14:12.102772
9	d4d6f1c3	2	13	2026-03-25 18:14:28.988515
10	cd8a21e2	2	14	2026-03-25 18:14:44.130218
11	b3674229	2	12	2026-03-25 18:14:54.162977
12	645e08c2	2	12	2026-03-25 18:15:06.658345
13	af0bae6b	2	12	2026-03-25 18:15:17.115846
14	7c40c1fe	2	14	2026-03-25 18:15:27.464227
15	310dffbe	2	13	2026-03-25 18:15:38.597149
16	de044e21	2	12	2026-03-25 18:15:48.328529
17	ff9d4c0a	2	12	2026-03-25 18:16:02.646272
18	5f81ff58	1	9	2026-03-25 18:17:26.680495
19	0eb01b3f	1	9	2026-03-25 18:17:48.346968
20	c69c9574	1	4	2026-03-25 18:18:02.349663
21	8011efd6	1	5	2026-03-25 18:18:12.08009
22	b6173d90	1	9	2026-03-25 18:18:21.192982
23	0589e0a0	1	9	2026-03-25 18:18:30.681278
24	3f05d95b	1	5	2026-03-25 18:18:40.466221
25	98b22812	1	4	2026-03-25 18:18:51.491326
26	1d728df7	1	4	2026-03-25 18:19:03.620787
27	b3a660a1	1	9	2026-03-25 18:19:13.397175
28	fbfe8137	1	9	2026-03-25 18:19:24.178125
29	1ad6ba8f	1	9	2026-03-25 18:19:33.403245
30	987bcc2b	29	17	2026-03-25 19:34:00.064827
31	7a55b9e7	29	16	2026-03-25 19:34:11.421172
32	da639e24	29	15	2026-03-25 19:34:21.046332
33	9d274f91	29	15	2026-03-25 19:34:30.37807
34	21e9fa1f	29	15	2026-03-25 19:34:38.577815
35	4ecb7813	29	15	2026-03-25 19:34:46.480093
36	92c8284a	29	17	2026-03-25 19:34:54.304841
37	d8143c2d	29	15	2026-03-25 19:35:05.049419
38	a21a8588	29	17	2026-03-25 19:35:15.89709
39	0d1ddb49	7	7	2026-04-01 18:30:41.827064
40	44039622	7	7	2026-04-01 18:32:07.696186
41	7893abf4	42	30	2026-04-03 22:57:02.401472
42	c62e021a	42	30	2026-04-03 22:57:21.777761
43	f73e274b	42	31	2026-04-03 22:57:33.04562
44	c490f5f4	50	33	2026-04-04 02:47:09.502628
45	eb625ae4	50	33	2026-04-04 02:48:40.260838
46	b31fd8e4	50	33	2026-04-04 02:49:08.508581
47	f1657dd6	42	30	2026-04-04 05:58:56.096814
135	08c81688	56	55	2026-04-04 09:54:34.621684
136	5b75a56d	56	56	2026-04-04 09:55:47.459133
137	05b1be49	56	55	2026-04-04 09:56:00.019933
48	cb647c5e	51	36	2026-04-05 14:55:56.952213
49	2239c5b8	51	36	2026-04-06 17:33:13.0444
50	0490a2df	51	36	2026-04-06 17:50:27.598478
51	a2caab62	51	36	2026-04-05 09:51:00.747877
52	6e68f3f6	51	36	2026-04-05 12:21:39.766738
53	42354a1a	51	36	2026-04-05 11:03:11.844269
54	47733e9d	51	36	2026-04-06 04:56:04.679194
55	5ed59952	51	36	2026-04-06 01:22:32.70578
56	4667684d	51	36	2026-04-05 21:11:04.334026
57	5d4e5bc5	51	35	2026-04-06 10:27:17.678118
58	e73ab68c	51	35	2026-04-06 14:32:24.206852
59	f4cc0578	51	35	2026-04-06 00:58:40.564532
60	233951bb	51	35	2026-04-06 04:52:18.025821
61	dc34cb29	51	35	2026-04-06 01:44:04.059439
62	876d382d	51	37	2026-04-06 17:49:10.101217
63	e6bc3302	51	37	2026-04-06 10:33:57.594502
64	4c2cad60	51	40	2026-04-05 17:43:09.861206
65	65f00855	51	40	2026-04-06 06:49:16.670202
66	f482abe6	51	40	2026-04-06 07:37:21.656461
67	9d4395c3	51	40	2026-04-06 07:46:02.219844
68	4dbd2933	51	38	2026-04-06 08:10:36.732712
69	cedf43fb	51	36	2026-04-06 17:14:18.275443
70	8f9d81a1	51	35	2026-04-05 09:54:31.143877
71	df49ddf8	51	35	2026-04-05 12:13:39.187718
72	213ae983	51	36	2026-04-06 06:56:33.960692
73	5e5e0991	51	36	2026-04-05 13:28:13.504882
74	7f6dadb2	51	36	2026-04-06 14:06:06.4657
75	9c28db96	51	36	2026-04-06 01:14:10.872726
76	b93b2bf4	51	36	2026-04-06 09:59:24.207087
77	2434cbb5	51	36	2026-04-06 07:58:09.892831
78	13a44f67	51	35	2026-04-06 09:39:28.067854
79	81bcc700	51	40	2026-04-05 13:47:55.640928
80	183f38a7	51	38	2026-04-06 16:58:49.535888
81	da65154d	52	42	2026-04-06 13:10:25.500876
82	4a884856	52	42	2026-04-06 11:56:42.827839
83	b2731faf	52	42	2026-04-06 04:21:47.514614
84	8ec8d9de	52	42	2026-04-05 20:04:38.502357
85	2213bbe1	52	42	2026-04-06 06:03:00.243408
86	f3425c61	52	42	2026-04-06 10:50:24.235054
87	fad1f9bd	52	42	2026-04-06 08:22:56.296886
88	cb4d96f3	52	42	2026-04-06 14:23:19.849839
89	15cd401e	52	42	2026-04-05 23:18:19.739298
90	2efd1467	52	45	2026-04-06 07:10:29.062704
91	d434f851	52	45	2026-04-05 19:22:59.394548
92	b7dc45c7	52	45	2026-04-05 21:16:42.528392
93	725ab443	52	41	2026-04-06 16:36:57.933269
94	41c771d6	52	41	2026-04-06 12:51:41.894426
95	ef1fb97e	52	41	2026-04-06 05:30:00.310814
96	e843ae06	52	43	2026-04-05 14:16:04.795873
97	c153c70f	52	43	2026-04-06 11:09:04.811555
98	2cfd798b	52	44	2026-04-06 10:36:49.216557
99	357560fd	53	46	2026-04-05 14:10:56.317944
100	7600ee0f	53	46	2026-04-05 14:32:09.460282
101	1fe5dbc9	53	46	2026-04-05 10:48:03.135788
102	d4d37a80	53	46	2026-04-06 01:11:38.376562
103	252bb80e	53	46	2026-04-06 07:04:08.349661
104	bf8097f5	53	46	2026-04-06 11:03:37.009757
105	193b3bd8	53	47	2026-04-05 17:43:25.557979
106	b99ff2d1	53	47	2026-04-06 03:37:38.314077
107	51690736	53	46	2026-04-05 10:40:00.151589
108	4ce50186	54	49	2026-04-06 11:33:51.851938
109	7050c134	54	49	2026-04-05 23:07:05.332602
110	c0fd1cbc	54	49	2026-04-06 15:34:17.295281
111	7a1f1919	54	49	2026-04-06 09:35:12.101848
112	ecd1c2b6	54	49	2026-04-06 07:07:04.578073
113	bc4042d8	54	49	2026-04-05 09:26:17.21518
114	725a0d63	54	51	2026-04-05 12:38:40.47015
115	47a9151a	54	51	2026-04-06 17:17:14.115155
116	ca087e49	54	50	2026-04-05 10:17:01.659874
117	c74bbb32	55	52	2026-04-05 20:29:54.041568
118	56e67a47	55	52	2026-04-05 13:46:22.663413
119	4efde4cb	55	52	2026-04-05 21:43:58.966848
120	191ad96c	55	52	2026-04-06 07:37:02.634813
121	b32574a8	55	52	2026-04-06 11:41:09.978766
122	81adaabb	55	52	2026-04-06 09:29:16.762079
123	fda10cb8	55	52	2026-04-05 15:34:29.153357
124	c9544d9f	55	52	2026-04-06 06:44:43.536831
125	f5523c2f	55	52	2026-04-05 12:46:43.590564
126	63c90796	55	52	2026-04-05 22:33:08.037236
127	750f52da	55	54	2026-04-05 17:43:52.164243
128	3e0f351e	55	54	2026-04-05 15:54:45.927391
129	97d0834f	55	54	2026-04-05 16:57:31.74521
130	1b612223	55	54	2026-04-05 11:40:43.028083
131	d64badcd	55	54	2026-04-06 09:35:54.637541
132	2aa4a495	55	54	2026-04-06 09:28:41.450073
133	f8f68186	55	54	2026-04-06 01:00:09.592877
134	32ec34e7	55	53	2026-04-06 01:13:44.644191
138	b499ccd0	51	36	2026-04-04 10:43:10.564716
\.


--
-- Data for Name: voting_token; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.voting_token (token_id, voter_id, booth_id, issued_at, expires_at, is_used, batch_id) FROM stdin;
\.


--
-- Name: audit_log_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_log_log_id_seq', 64, true);


--
-- Name: ballot_unit_unit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ballot_unit_unit_id_seq', 1, false);


--
-- Name: booth_watcher_watcher_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.booth_watcher_watcher_id_seq', 1, false);


--
-- Name: candidate_candidate_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.candidate_candidate_id_seq', 57, true);


--
-- Name: constituency_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.constituency_id_seq', 13, true);


--
-- Name: constituency_of_election_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.constituency_of_election_id_seq', 58, true);


--
-- Name: dispute_log_dispute_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dispute_log_dispute_id_seq', 1, false);


--
-- Name: election_election_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.election_election_id_seq', 26, true);


--
-- Name: election_schedule_schedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.election_schedule_schedule_id_seq', 1, false);


--
-- Name: login_log_login_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.login_log_login_id_seq', 34, true);


--
-- Name: override_approval_approval_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.override_approval_approval_id_seq', 1, false);


--
-- Name: poll_session_session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.poll_session_session_id_seq', 1, false);


--
-- Name: polling_booth_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.polling_booth_id_seq', 28, true);


--
-- Name: polling_center_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.polling_center_id_seq', 25, true);


--
-- Name: polling_center_of_election_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.polling_center_of_election_id_seq', 46, true);


--
-- Name: role_map_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.role_map_id_seq', 94, true);


--
-- Name: sensitive_operations_request_request_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sensitive_operations_request_request_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 28, true);


--
-- Name: vote_log_vote_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vote_log_vote_id_seq', 1, false);


--
-- Name: voter_of_election_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.voter_of_election_id_seq', 1525, true);


--
-- Name: voter_otp_otp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.voter_otp_otp_id_seq', 146, true);


--
-- Name: voter_participation_participation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.voter_participation_participation_id_seq', 1, false);


--
-- Name: voting_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.voting_log_id_seq', 138, true);


--
-- Name: voting_token_token_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.voting_token_token_id_seq', 1, false);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (log_id);


--
-- Name: ballot_unit ballot_unit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ballot_unit
    ADD CONSTRAINT ballot_unit_pkey PRIMARY KEY (unit_id);


--
-- Name: booth_watcher booth_watcher_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booth_watcher
    ADD CONSTRAINT booth_watcher_pkey PRIMARY KEY (watcher_id);


--
-- Name: candidate candidate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate
    ADD CONSTRAINT candidate_pkey PRIMARY KEY (candidate_id);


--
-- Name: constituency_of_election constituency_of_election_election_id_constituency_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constituency_of_election
    ADD CONSTRAINT constituency_of_election_election_id_constituency_id_key UNIQUE (election_id, constituency_id);


--
-- Name: constituency_of_election constituency_of_election_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constituency_of_election
    ADD CONSTRAINT constituency_of_election_pkey PRIMARY KEY (id);


--
-- Name: constituency constituency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constituency
    ADD CONSTRAINT constituency_pkey PRIMARY KEY (id);


--
-- Name: dispute_log dispute_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute_log
    ADD CONSTRAINT dispute_log_pkey PRIMARY KEY (dispute_id);


--
-- Name: election election_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.election
    ADD CONSTRAINT election_pkey PRIMARY KEY (election_id);


--
-- Name: election_schedule election_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.election_schedule
    ADD CONSTRAINT election_schedule_pkey PRIMARY KEY (schedule_id);


--
-- Name: login_log login_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_log
    ADD CONSTRAINT login_log_pkey PRIMARY KEY (login_id);


--
-- Name: override_approval override_approval_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.override_approval
    ADD CONSTRAINT override_approval_pkey PRIMARY KEY (approval_id);


--
-- Name: poll_session poll_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_session
    ADD CONSTRAINT poll_session_pkey PRIMARY KEY (session_id);


--
-- Name: polling_booth polling_booth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polling_booth
    ADD CONSTRAINT polling_booth_pkey PRIMARY KEY (id);


--
-- Name: polling_center_of_election polling_center_of_election_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polling_center_of_election
    ADD CONSTRAINT polling_center_of_election_pkey PRIMARY KEY (id);


--
-- Name: polling_center_of_election polling_center_of_election_polling_center_id_election_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polling_center_of_election
    ADD CONSTRAINT polling_center_of_election_polling_center_id_election_id_key UNIQUE (polling_center_id, election_id);


--
-- Name: polling_center polling_center_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polling_center
    ADD CONSTRAINT polling_center_pkey PRIMARY KEY (id);


--
-- Name: role_map role_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_map
    ADD CONSTRAINT role_map_pkey PRIMARY KEY (id);


--
-- Name: sensitive_operations_request sensitive_operations_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensitive_operations_request
    ADD CONSTRAINT sensitive_operations_request_pkey PRIMARY KEY (request_id);


--
-- Name: poll_session uq_election_center; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_session
    ADD CONSTRAINT uq_election_center UNIQUE (election_id, center_id);


--
-- Name: election uq_election_name_start; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.election
    ADD CONSTRAINT uq_election_name_start UNIQUE (name, start_date);


--
-- Name: override_approval uq_override_per_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.override_approval
    ADD CONSTRAINT uq_override_per_user UNIQUE (request_id, user_id);


--
-- Name: vote_log uq_unit_seq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote_log
    ADD CONSTRAINT uq_unit_seq UNIQUE (unit_id, seq_number);


--
-- Name: voter_participation uq_voter_session; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_participation
    ADD CONSTRAINT uq_voter_session UNIQUE (voter_id, session_id);


--
-- Name: booth_watcher uq_watcher_per_booth; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booth_watcher
    ADD CONSTRAINT uq_watcher_per_booth UNIQUE (user_id, booth_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vote_log vote_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote_log
    ADD CONSTRAINT vote_log_pkey PRIMARY KEY (vote_id);


--
-- Name: voter_of_election voter_of_election_nid_election_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_of_election
    ADD CONSTRAINT voter_of_election_nid_election_id_key UNIQUE (nid, election_id);


--
-- Name: voter_of_election voter_of_election_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_of_election
    ADD CONSTRAINT voter_of_election_pkey PRIMARY KEY (id);


--
-- Name: voter_otp voter_otp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_otp
    ADD CONSTRAINT voter_otp_pkey PRIMARY KEY (otp_id);


--
-- Name: voter_participation voter_participation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_participation
    ADD CONSTRAINT voter_participation_pkey PRIMARY KEY (participation_id);


--
-- Name: voter voter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter
    ADD CONSTRAINT voter_pkey PRIMARY KEY (nid);


--
-- Name: voting_log voting_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voting_log
    ADD CONSTRAINT voting_log_pkey PRIMARY KEY (id);


--
-- Name: voting_token voting_token_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voting_token
    ADD CONSTRAINT voting_token_pkey PRIMARY KEY (token_id);


--
-- Name: idx_candidate_constituency_election; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_constituency_election ON public.candidate USING btree (constituency_of_election_id);


--
-- Name: idx_polling_booth_center; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polling_booth_center ON public.polling_booth USING btree (polling_center_id);


--
-- Name: idx_polling_booth_election; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polling_booth_election ON public.polling_booth USING btree (election_id);


--
-- Name: idx_polling_center_constituency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polling_center_constituency ON public.polling_center USING btree (constituency_id);


--
-- Name: idx_polling_center_coords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polling_center_coords ON public.polling_center USING btree (lat, lng);


--
-- Name: idx_polling_center_election; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polling_center_election ON public.polling_center_of_election USING btree (election_id);


--
-- Name: idx_polling_center_polling; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polling_center_polling ON public.polling_center_of_election USING btree (polling_center_id);


--
-- Name: idx_role_map_election; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_map_election ON public.role_map USING btree (election_id);


--
-- Name: idx_role_map_relation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_map_relation ON public.role_map USING btree (relation_id);


--
-- Name: idx_role_map_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_map_role ON public.role_map USING btree (role);


--
-- Name: idx_voter_constituency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_constituency ON public.voter USING btree (constituency_id);


--
-- Name: idx_voter_coords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_coords ON public.voter USING btree (lat, lng);


--
-- Name: idx_voter_election_assigned_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_election_assigned_by ON public.voter_of_election USING btree (assigned_by);


--
-- Name: idx_voter_election_booth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_election_booth ON public.voter_of_election USING btree (booth_id);


--
-- Name: idx_voter_election_center; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_election_center ON public.voter_of_election USING btree (center_id);


--
-- Name: idx_voter_election_election; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_election_election ON public.voter_of_election USING btree (election_id);


--
-- Name: idx_voter_election_nid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_election_nid ON public.voter_of_election USING btree (nid);


--
-- Name: idx_voter_election_otp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_election_otp ON public.voter_of_election USING btree (last_otp_sent_at);


--
-- Name: idx_voter_election_voted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_election_voted ON public.voter_of_election USING btree (last_voted_at);


--
-- Name: idx_voter_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_email ON public.voter USING btree (email);


--
-- Name: idx_voter_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_name ON public.voter USING btree (name);


--
-- Name: idx_voter_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_phone ON public.voter USING btree (phone);


--
-- Name: idx_voter_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voter_type ON public.voter USING btree (voter_type);


--
-- Name: idx_voting_log_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voting_log_candidate ON public.voting_log USING btree (candidate_id);


--
-- Name: idx_voting_log_constituency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voting_log_constituency ON public.voting_log USING btree (constituency_of_election_id);


--
-- Name: idx_voting_log_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voting_log_token ON public.voting_log USING btree (voter_token);


--
-- Name: polling_booth trg_polling_booth_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_polling_booth_delete AFTER DELETE ON public.polling_booth FOR EACH ROW EXECUTE FUNCTION public.handle_polling_booth_delete();


--
-- Name: polling_center_of_election trg_polling_center_election_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_polling_center_election_delete AFTER DELETE ON public.polling_center_of_election FOR EACH ROW EXECUTE FUNCTION public.handle_polling_center_election_delete();


--
-- Name: candidate candidate_constituency_of_election_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate
    ADD CONSTRAINT candidate_constituency_of_election_id_fkey FOREIGN KEY (constituency_of_election_id) REFERENCES public.constituency_of_election(id) ON DELETE SET NULL;


--
-- Name: constituency_of_election constituency_of_election_constituency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constituency_of_election
    ADD CONSTRAINT constituency_of_election_constituency_id_fkey FOREIGN KEY (constituency_id) REFERENCES public.constituency(id) ON DELETE CASCADE;


--
-- Name: role_map fk_role_map_election; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_map
    ADD CONSTRAINT fk_role_map_election FOREIGN KEY (election_id) REFERENCES public.election(election_id) ON DELETE CASCADE;


--
-- Name: voting_log fk_voting_log_candidate; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voting_log
    ADD CONSTRAINT fk_voting_log_candidate FOREIGN KEY (candidate_id) REFERENCES public.candidate(candidate_id);


--
-- Name: voting_log fk_voting_log_constituency; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voting_log
    ADD CONSTRAINT fk_voting_log_constituency FOREIGN KEY (constituency_of_election_id) REFERENCES public.constituency_of_election(id);


--
-- Name: override_approval override_approval_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.override_approval
    ADD CONSTRAINT override_approval_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.sensitive_operations_request(request_id);


--
-- Name: poll_session poll_session_election_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_session
    ADD CONSTRAINT poll_session_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.election(election_id);


--
-- Name: polling_booth polling_booth_polling_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polling_booth
    ADD CONSTRAINT polling_booth_polling_center_id_fkey FOREIGN KEY (polling_center_id) REFERENCES public.polling_center(id) ON DELETE CASCADE;


--
-- Name: polling_center polling_center_constituency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polling_center
    ADD CONSTRAINT polling_center_constituency_id_fkey FOREIGN KEY (constituency_id) REFERENCES public.constituency(id) ON DELETE SET NULL;


--
-- Name: polling_center_of_election polling_center_of_election_polling_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polling_center_of_election
    ADD CONSTRAINT polling_center_of_election_polling_center_id_fkey FOREIGN KEY (polling_center_id) REFERENCES public.polling_center(id) ON DELETE CASCADE;


--
-- Name: role_map role_map_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_map
    ADD CONSTRAINT role_map_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vote_log vote_log_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote_log
    ADD CONSTRAINT vote_log_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate(candidate_id);


--
-- Name: vote_log vote_log_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote_log
    ADD CONSTRAINT vote_log_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.ballot_unit(unit_id);


--
-- Name: voter voter_constituency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter
    ADD CONSTRAINT voter_constituency_id_fkey FOREIGN KEY (constituency_id) REFERENCES public.constituency(id) ON DELETE SET NULL;


--
-- Name: voter_of_election voter_of_election_booth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_of_election
    ADD CONSTRAINT voter_of_election_booth_id_fkey FOREIGN KEY (booth_id) REFERENCES public.polling_booth(id) ON DELETE SET NULL;


--
-- Name: voter_of_election voter_of_election_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_of_election
    ADD CONSTRAINT voter_of_election_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.polling_center(id) ON DELETE SET NULL;


--
-- Name: voter_of_election voter_of_election_election_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_of_election
    ADD CONSTRAINT voter_of_election_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.election(election_id) ON DELETE CASCADE;


--
-- Name: voter_of_election voter_of_election_nid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_of_election
    ADD CONSTRAINT voter_of_election_nid_fkey FOREIGN KEY (nid) REFERENCES public.voter(nid) ON DELETE CASCADE;


--
-- Name: voter_participation voter_participation_otp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_participation
    ADD CONSTRAINT voter_participation_otp_id_fkey FOREIGN KEY (otp_id) REFERENCES public.voter_otp(otp_id);


--
-- Name: voter_participation voter_participation_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_participation
    ADD CONSTRAINT voter_participation_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.poll_session(session_id);


--
-- Name: voter_participation voter_participation_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voter_participation
    ADD CONSTRAINT voter_participation_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.voting_token(token_id);


--
-- PostgreSQL database dump complete
--

\unrestrict RJeQ9x58IUhQgI0kFkPKVjavHNYrdNWuQ9rDWuntUXQcHWqPRSHcSKr7xOrgjhl

