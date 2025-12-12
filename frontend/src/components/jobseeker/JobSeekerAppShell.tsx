import React, { PropsWithChildren } from 'react';
import { Outlet } from 'react-router-dom';
import { JobsLayout } from '../layout/JobsLayout';

export default function JobSeekerAppShell({ children }: PropsWithChildren) {
  return <JobsLayout>{children || <Outlet />}</JobsLayout>;
}
