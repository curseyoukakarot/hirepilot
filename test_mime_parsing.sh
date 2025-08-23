#!/bin/bash
curl -v -X POST https://api.thehirepilot.com/api/sendgrid/inbound \
  -F "to=msg_cb784fb5-b845-4693-b329-1aa7d06472d0.u_02a42d5c-0f65-4c58-8175-8304610c2ddc.c_none@reply.thehirepilot.com" \
  -F "from=John Doe <candidate@example.com>" \
  -F "subject=Re: Software Engineer Position" \
  -F "text=Hi there! I am very interested in this position. Can we schedule a call?" \
  -F "html=<p>Hi there!</p><p>I am very interested in this position.</p>" \
  -F "email=From: candidate@example.com
To: reply@thehirepilot.com
Subject: Re: Software Engineer Position
Content-Type: text/plain

Hi there! This is from the MIME parser. I am very interested in this position. Can we schedule a call?"
