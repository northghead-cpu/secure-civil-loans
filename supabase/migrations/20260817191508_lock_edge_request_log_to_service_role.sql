REVOKE ALL ON TABLE public.edge_request_log FROM anon, authenticated; REVOKE ALL ON TABLE public.edge_request_log FROM PUBLIC; GRANT ALL ON TABLE public.edge_request_log TO service_role;
