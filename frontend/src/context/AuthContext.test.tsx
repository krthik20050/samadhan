import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { staffSession } from '../lib/auth';

vi.mock('../lib/clerk',()=>({clerkEnabled:false}));
const request=vi.fn();
function LoginProbe(){const auth=useAuth();return <><button onClick={()=>void auth.login('123','123')}>Test login</button><p>{auth.isAdmin?'Admin authenticated':'Signed out'}</p></>;}
beforeEach(()=>{sessionStorage.clear();vi.clearAllMocks();vi.stubGlobal('fetch',request);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('accepts a three-character password and sends the ID, while saving the server-issued token',async()=>{
  request.mockResolvedValue({ok:true,json:async()=>({role:'admin',token:'server-issued-staff-token'})});
  render(<AuthProvider><LoginProbe/></AuthProvider>);fireEvent.click(screen.getByText('Test login'));
  await screen.findByText('Admin authenticated');
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({identifier:'123',password:'123'});
  expect(staffSession.token()).toBe('server-issued-staff-token');
});
it('revalidates a saved session with its bearer rather than treating it as the login password',async()=>{
  staffSession.save('123','server-issued-staff-token');request.mockResolvedValue({ok:true});
  render(<AuthProvider><LoginProbe/></AuthProvider>);
  await waitFor(()=>expect(request).toHaveBeenCalled());
  expect(request.mock.calls[0][1].headers.Authorization).toBe('Bearer server-issued-staff-token');
  expect(request.mock.calls[0][1].body).toBe('{}');
});
