
-- Create storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);

-- Users can upload their own documents
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own documents
CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own documents
CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
