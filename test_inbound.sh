#!/bin/bash
curl -X POST https://api.thehirepilot.com/api/sendgrid/inbound \
  -F "to=msg_88894c72-b83d-451f-9979-1d92272bb1e7.u_02a42d5c-0f65-4c58-8175-8304610c2ddc.c_none@reply.thehirepilot.com" \
  -F "from=brandon@offrgroup.com" \
  -F "subject=Reply Test from cURL" \
  -F "text=Hey just testing the inbound reply from cURL" \
  -F "html=<p>Hey just testing the inbound reply from cURL</p>"
