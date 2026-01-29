## Resume Export Quick Test

These commands call the export endpoint and download the PDF to disk.
Replace `RESUME_ID` and `BACKEND_URL`, and provide a valid auth token.

Normal export:

```
curl -s -X POST "$BACKEND_URL/api/resumes/RESUME_ID/export" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"templateSlug":"gray-gold-clean"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['pdfUrl'])" \
  | xargs -I {} curl -L "{}" -o /tmp/resume-gray-gold-clean.pdf
```

Debug overlay export:

```
curl -s -X POST "$BACKEND_URL/api/resumes/RESUME_ID/export?debug=1" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"templateSlug":"gray-gold-clean"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['pdfUrl'])" \
  | xargs -I {} curl -L "{}" -o /tmp/resume-gray-gold-clean-debug.pdf
```
