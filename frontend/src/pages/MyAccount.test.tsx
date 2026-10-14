import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../context/LanguageContext';
import { MyAccount } from './MyAccount';

const mocks=vi.hoisted(()=>({api:vi.fn(),getToken:vi.fn(),userId:'user_test'}));
vi.mock('../lib/clerk',()=>({clerkEnabled:true}));
vi.mock('../lib/api/client',()=>({api:mocks.api}));
vi.mock('@clerk/react',()=>({useAuth:()=>({isLoaded:true,isSignedIn:true,userId:mocks.userId,getToken:mocks.getToken}),useUser:()=>({user:{fullName:'Test Passenger',imageUrl:'https://example.com/profile.png',primaryEmailAddress:{emailAddress:'test@example.com'}}}),UserButton:()=>null,SignInButton:()=>null}));
const data={profile:{id:'internal',display_name:'Test Passenger',email:'test@example.com',member_since:'2026-10-14'},stats:{total_filed:3,open:1,resolved:1,closed:1},recent_complaints:[{reference_id:'SAM-TEST',status:'resolved',category:'cleanliness',route_text:'Guruvayur → Ernakulam',created_at:'2026-10-14',latest_action:'Depot checked and cleaned the bus.'}],monthly_activity:[{month:'2026-10',filed:3,resolved:1}],activity:[{reference_id:'SAM-TEST',to_status:'resolved',note:'Depot checked and cleaned the bus.',created_at:'2026-10-14'}],filtered_total:3,has_more:false};
function mount(){return render(<LanguageProvider><MemoryRouter><MyAccount/></MemoryRouter></LanguageProvider>);}
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();mocks.userId='user_test';mocks.getToken.mockResolvedValue('current-session');mocks.api.mockResolvedValue(data);});
afterEach(cleanup);
describe('Passenger dashboard',()=>{
  it('uses the current session, Google profile image and actual outcomes/actions',async()=>{
    mount();await screen.findAllByText('SAM-TEST');
    expect(mocks.api).toHaveBeenCalledWith('/api/v1/me?limit=50&offset=0',{headers:{Authorization:'Bearer current-session'}});
    expect(screen.getByRole('img',{name:'Test Passenger'}).getAttribute('src')).toBe('https://example.com/profile.png');
    expect(screen.getAllByText('Depot checked and cleaned the bus.')).toHaveLength(2);
    expect(screen.getByRole('button',{name:/Resolved 1/})).toBeTruthy();expect(screen.getByRole('button',{name:/Closed 1/})).toBeTruthy();
  });
  it('requests resolved complaints from the server rather than filtering only the first page',async()=>{
    mount();await screen.findAllByText('SAM-TEST');fireEvent.click(screen.getByRole('button',{name:'Resolved'}));
    await waitFor(()=>expect(mocks.api).toHaveBeenLastCalledWith('/api/v1/me?limit=50&offset=0&status=resolved',expect.anything()));
  });
  it('shows unavailable counts when the API fails instead of invented zeroes',async()=>{
    mocks.api.mockRejectedValue(new Error('unavailable'));mount();await screen.findByRole('alert');
    expect(screen.getAllByText('—')).toHaveLength(4);expect(screen.queryByText('No complaints yet.')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Try Again'}));await waitFor(()=>expect(mocks.api).toHaveBeenCalledTimes(2));
  });
  it('hides the previous passenger’s complaint data when accounts change',async()=>{
    const rendered=mount();await screen.findAllByText('SAM-TEST');
    mocks.userId='user_another';mocks.api.mockImplementation(()=>new Promise(()=>{}));
    rendered.rerender(<LanguageProvider><MemoryRouter><MyAccount/></MemoryRouter></LanguageProvider>);
    expect(screen.queryByText('SAM-TEST')).toBeNull();expect(screen.getAllByText('—')).toHaveLength(4);
  });
});
