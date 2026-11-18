(() => {
  const $ = (id) => document.getElementById(id);
  const api = () => window.EMS_API;
  const toast = (message) => window.showToast(message);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const value = (id) => $(id)?.value?.trim() ?? '';
  const asDate = (input) => {
    if (!input) return '';
    if (typeof input === 'string') return input.slice(0, 10);
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };
  const options = (rows, label, selected = '') => rows.map((row) => `<option value="${esc(row.id)}" ${String(row.id) === String(selected) ? 'selected' : ''}>${esc(label(row))}</option>`).join('');
  const setRows = (id, html, empty, colspan) => {
    const target = $(id);
    if (target) target.innerHTML = html || `<tr><td colspan="${colspan}">${esc(empty)}</td></tr>`;
  };
  const formButtonBusy = async (form, operation) => {
    const button = form.querySelector('[type="submit"]');
    const wasDisabled = button ? button.disabled : false;
    if (button) button.disabled = true;
    try { await operation(); }
    catch (err) { toast(err.message); }
    finally {
      if (button) button.disabled = form.dataset.keepSubmitDisabled === 'true' ? true : wasDisabled;
      delete form.dataset.keepSubmitDisabled;
    }
  };
  const submit = (id, operation) => {
    const form = $(id);
    if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      formButtonBusy(form, operation);
    });
  };
  const dateLabel = (date) => asDate(date) || '—';

  async function voterPage() {
    const [profile, booths, elections] = await Promise.all([
      api().get('/voters/me'), api().get('/booths/'), api().get('/elections/')
    ]);
    $('profile-name').value = profile.full_name || '';
    $('profile-email').value = profile.email || '';
    $('profile-phone').value = profile.phone || '';
    $('profile-address').value = profile.address || '';
    $('profile-dob').value = asDate(profile.dob);
    $('profile-booth').value = booths.find((b) => b.id === profile.booth_id)?.code || '';
    $('app-dob').value = asDate(profile.dob);
    $('app-phone').value = profile.phone || '';
    $('app-address').value = profile.address || '';
    $('app-booth').value = $('profile-booth').value;

    const resolveBooth = (text) => {
      if (!text) return null;
      const term = text.toLowerCase();
      const booth = booths.find((b) => [b.code, b.name, b.area].some((v) => (v || '').toLowerCase() === term));
      if (!booth) throw new Error('Booth not found. Enter an exact booth code, name or area, or leave it blank.');
      return booth.id;
    };

    submit('voter-profile-form', async () => {
      const boothId = resolveBooth(value('profile-booth'));
      await api().patch('/voters/me', { phone: value('profile-phone'), address: value('profile-address'), dob: value('profile-dob') || null, boothId });
      toast('Voter profile updated.');
    });
    submit('application-form', async () => {
      const boothId = resolveBooth(value('app-booth'));
      const result = await api().post('/applications', {
        applicationType: value('application-type'), dob: value('app-dob'), phone: value('app-phone'), address: value('app-address'), boothId
      });
      toast(`Application submitted. Reference: ${result.referenceCode}`);
      $('reference').value = result.referenceCode;
      $('application-form').reset();
      await loadMyApplications();
    });

    async function loadMyApplications() {
      const rows = await api().get('/applications/mine');
      setRows('my-applications', rows.map((row) => `<tr><td>${esc(row.reference_code)}</td><td>${esc(row.application_type)}</td><td><span class="status">${esc(row.status)}</span></td><td>${esc(dateLabel(row.created_at))}</td><td>${esc(row.review_notes || '—')}</td></tr>`).join(''), 'No applications found.', 5);
    }
    $('refresh-applications')?.addEventListener('click', () => loadMyApplications().catch((e) => toast(e.message)));
    await loadMyApplications();

    $('booth-search-form').addEventListener('submit', (event) => {
      event.preventDefault(); if (!event.currentTarget.reportValidity()) return;
      const term = value('booth-search').toLowerCase();
      const matches = booths.filter((b) => [b.code, b.name, b.area, b.address].some((v) => (v || '').toLowerCase().includes(term)));
      $('booth-result').innerHTML = matches.length ? matches.map((b) => `<p><strong>${esc(b.code)} — ${esc(b.name)}</strong><br>${esc(b.area || '')}<br>${esc(b.address || '')}</p>`).join('') : '<p>No matching booth found.</p>';
    });
    $('track-form').addEventListener('submit', async (event) => {
      event.preventDefault(); if (!event.currentTarget.reportValidity()) return;
      try {
        const result = await api().get(`/applications/track/${encodeURIComponent(value('reference'))}`);
        $('track-result').textContent = `${result.reference_code}: ${result.status}${result.review_notes ? ` — ${result.review_notes}` : ''}`;
      } catch (err) { $('track-result').textContent = err.message; }
    });

    const openElections = elections.filter((e) => e.status === 'Open');
    $('vote-election').innerHTML = '<option value="">Select election</option>' + options(openElections, (e) => `${e.name} (${dateLabel(e.election_date)})`);
    $('vote-election').addEventListener('change', async () => {
      delete $('voting-form').dataset.keepSubmitDisabled;
      $('vote-candidate').disabled = true;
      $('vote-candidate').innerHTML = '<option value="">Loading candidates…</option>';
      $('vote-eligibility').textContent = '';
      $('voting-form').querySelector('[type="submit"]').disabled = true;
      if (!value('vote-election')) return;
      try {
        const [candidates, eligibility] = await Promise.all([
          api().get(`/elections/${value('vote-election')}/candidates`), api().get(`/votes/eligibility/${value('vote-election')}`)
        ]);
        $('vote-candidate').innerHTML = '<option value="">Select candidate</option>' + options(candidates, (c) => `${c.candidate_name}${c.party_name ? ` — ${c.party_name}` : ''}`);
        $('vote-candidate').disabled = candidates.length === 0;
        const today = new Date();
        const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const canVote = eligibility.status === 'Open' && asDate(eligibility.election_date) <= localToday && Number(eligibility.applicationApproved) === 1 && Number(eligibility.hasVoted) === 0 && candidates.length > 0;
        $('vote-eligibility').textContent = Number(eligibility.hasVoted) === 1 ? 'Our records show that you have already voted in this election.' : Number(eligibility.applicationApproved) !== 1 ? 'An approved voter application is required before voting.' : eligibility.status !== 'Open' ? `Voting is not open (current status: ${eligibility.status}).` : asDate(eligibility.election_date) > localToday ? 'Voting is not available until the scheduled election date.' : candidates.length === 0 ? 'No candidates have been assigned to this election.' : 'You appear eligible. Select a candidate to continue.';
        $('voting-form').querySelector('[type="submit"]').disabled = !canVote;
      } catch (err) { $('vote-candidate').innerHTML = '<option value="">Unable to load candidates</option>'; $('vote-eligibility').textContent = err.message; }
    });
    submit('voting-form', async () => {
      if (!window.confirm('Submit your vote? This action cannot be undone.')) return;
      await api().post('/votes', { electionId: value('vote-election'), candidateId: value('vote-candidate') });
      toast('Your vote was recorded.');
      $('vote-election').dispatchEvent(new Event('change'));
      $('voting-form').dataset.keepSubmitDisabled = 'true';
    });
    $('voting-form').querySelector('[type="submit"]').disabled = true;
  }

  async function partyPage() {
    const profile = await api().get('/parties/me');
    $('party-name').value = profile.party_name || '';
    $('party-symbol').value = profile.symbol || '';
    $('party-contact').value = profile.contact_email || '';
    $('manifesto').value = profile.manifesto || '';
    submit('party-profile-form', async () => {
      await api().patch('/parties/me', { partyName: value('party-name'), symbol: value('party-symbol'), contactEmail: value('party-contact'), manifesto: value('manifesto') });
      toast('Party profile saved.');
    });
    async function loadCandidates() {
      const rows = await api().get('/candidates/mine');
      setRows('party-candidates', rows.map((c) => `<tr><td>${esc(c.candidate_name)}</td><td>${esc(c.constituency || '—')}</td><td>${esc(c.contact_email || '—')}</td><td>${esc(c.bio || '—')}</td></tr>`).join(''), 'No party candidates have been added.', 4);
    }
    submit('party-candidate-form', async () => {
      await api().post('/candidates', { candidateName: value('new-candidate-name'), constituency: value('new-candidate-constituency'), contactEmail: value('new-candidate-email'), bio: value('new-candidate-bio') });
      toast('Candidate added to your party.'); $('party-candidate-form').reset(); await loadCandidates();
    });
    await loadCandidates();
  }

  async function candidatePage() {
    const [profile, parties] = await Promise.all([api().get('/candidates/me'), api().get('/parties')]);
    $('candidate-name').value = profile.candidate_name || '';
    $('candidate-constituency').value = profile.constituency || '';
    $('candidate-contact').value = profile.contact_email || '';
    $('candidate-bio').value = profile.bio || '';
    $('candidate-party').innerHTML = '<option value="">Independent / no party</option>' + options(parties, (p) => p.party_name, profile.party_id);
    submit('candidate-profile-form', async () => {
      await api().patch('/candidates/me', { candidateName: value('candidate-name'), partyId: value('candidate-party') || null, constituency: value('candidate-constituency'), contactEmail: value('candidate-contact'), bio: value('candidate-bio') });
      toast('Candidate profile saved.'); await loadDirectory();
    });
    async function loadDirectory() {
      const rows = await api().get('/candidates');
      setRows('candidate-directory', rows.map((c) => `<tr><td>${esc(c.candidate_name)}</td><td>${esc(c.party_name || 'Independent')}</td><td>${esc(c.constituency || '—')}</td><td>${esc(c.contact_email || '—')}</td><td>${esc(c.bio || '—')}</td></tr>`).join(''), 'No candidates have been registered.', 5);
    }
    $('refresh-candidates')?.addEventListener('click', () => loadDirectory().catch((e) => toast(e.message)));
    await loadDirectory();
  }

  async function applicationsPage(tableId, role) {
    async function load() {
      const rows = await api().get('/applications');
      setRows(tableId, rows.map((a) => {
        const action = `<button class="btn btn-small" type="button" data-review-id="${esc(a.id)}" data-review-reference="${esc(a.reference_code)}" data-review-status="${esc(a.status)}" data-review-notes="${esc(a.review_notes || '')}">Review</button>`;
        if (role === 'BLO') return `<tr><td>${esc(a.reference_code)}</td><td>${esc(a.voter_name)}</td><td>${esc(a.application_type)}</td><td>${esc(a.booth_code || '—')}</td><td>${esc(a.status)}</td><td>${action}</td></tr>`;
        return `<tr><td>${esc(a.reference_code)}</td><td>${esc(a.voter_name)}</td><td>${esc(a.application_type)}</td><td>${esc(a.status)}</td><td>${action}</td></tr>`;
      }).join(''), 'No voter applications found.', role === 'BLO' ? 6 : 5);
      document.querySelectorAll('[data-review-id]').forEach((button) => button.addEventListener('click', () => {
        $('review-id').value = button.dataset.reviewId;
        $('app-ref').value = button.dataset.reviewReference;
        $('review-outcome').value = button.dataset.reviewStatus === 'Pending' ? '' : button.dataset.reviewStatus;
        $('review-notes').value = button.dataset.reviewNotes;
        $('review-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }));
    }
    $('refresh-applications')?.addEventListener('click', () => load().catch((e) => toast(e.message)));
    submit('review-form', async () => {
      if (!$('review-id').value) throw new Error('Choose an application from the review queue first.');
      await api().patch(`/applications/${$('review-id').value}/review`, { status: value('review-outcome'), reviewNotes: value('review-notes') });
      toast('Application review saved.'); $('review-form').reset(); $('review-id').value = ''; await load();
    });
    await load();
  }

  async function officerPage() {
    await applicationsPage('officer-applications', 'Officer');
    const [elections, candidates, booths] = await Promise.all([api().get('/elections'), api().get('/candidates'), api().get('/booths')]);
    $('assign-election').innerHTML = '<option value="">Select election</option>' + options(elections, (e) => `${e.name} (${e.status})`);
    $('assign-candidate').innerHTML = '<option value="">Select candidate</option>' + options(candidates, (c) => `${c.candidate_name}${c.party_name ? ` — ${c.party_name}` : ''}`);
    $('assign-booth').innerHTML = '<option value="">All / not specified</option>' + options(booths, (b) => `${b.code} — ${b.name}`);
    submit('election-form', async () => {
      await api().post('/elections', { name: value('election-name'), electionDate: value('election-date'), status: value('election-status'), description: value('election-description') });
      toast('Election created.'); $('election-form').reset(); await loadElections();
      const updated = await api().get('/elections');
      $('assign-election').innerHTML = '<option value="">Select election</option>' + options(updated, (e) => `${e.name} (${e.status})`);
    });
    submit('assign-candidate-form', async () => {
      await api().post(`/elections/${value('assign-election')}/candidates`, { candidateId: value('assign-candidate'), boothId: value('assign-booth') || null });
      toast('Candidate assigned to election.'); $('assign-candidate-form').reset();
    });
    async function loadElections() {
      const rows = await api().get('/elections');
      setRows('election-list', rows.map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(dateLabel(e.election_date))}</td><td>${esc(e.status)}</td><td><select aria-label="New status" data-election-status="${esc(e.id)}">${['Draft','Scheduled','Open','Closed','Published'].map((s) => `<option ${s === e.status ? 'selected' : ''}>${s}</option>`).join('')}</select> <button class="btn btn-small" type="button" data-save-election="${esc(e.id)}">Save</button></td></tr>`).join(''), 'No elections have been created.', 4);
      document.querySelectorAll('[data-save-election]').forEach((button) => button.addEventListener('click', async () => {
        const id = button.dataset.saveElection;
        const status = Array.from(document.querySelectorAll('[data-election-status]')).find((el) => el.dataset.electionStatus === id)?.value;
        button.disabled = true;
        try { await api().patch(`/elections/${id}/status`, { status }); toast('Election status updated.'); await loadElections(); }
        catch (err) { toast(err.message); }
        finally { button.disabled = false; }
      }));
    }
    await loadElections();
  }

  async function accountPage() {
    async function loadAccounts() {
      const rows = await api().get('/accounts');
      setRows('accounts-list', rows.map((a) => `<tr><td>${esc(a.full_name)}</td><td>${esc(a.username)}</td><td>${esc(a.email)}</td><td>${esc(a.role)}</td><td>${a.is_active ? 'Active' : 'Inactive'} · ${a.email_verified ? 'Verified' : 'Email pending'}</td><td>${a.role === 'DBA' ? '—' : `<button class="btn btn-small btn-secondary" type="button" data-account-toggle="${esc(a.id)}" data-active="${a.is_active ? '1' : '0'}">${a.is_active ? 'Deactivate' : 'Activate'}</button> <button class="btn btn-small" type="button" data-account-delete="${esc(a.id)}">Delete</button>`}</td></tr>`).join(''), 'No accounts found.', 6);
      document.querySelectorAll('[data-account-toggle]').forEach((button) => button.addEventListener('click', async () => {
        try { await api().patch(`/accounts/${button.dataset.accountToggle}/status`, { isActive: button.dataset.active !== '1' }); toast('Account status updated.'); await loadAccounts(); }
        catch (err) { toast(err.message); }
      }));
      document.querySelectorAll('[data-account-delete]').forEach((button) => button.addEventListener('click', async () => {
        if (!window.confirm('Delete this account and its linked profile data? This cannot be undone.')) return;
        try { await api().delete(`/accounts/${button.dataset.accountDelete}`); toast('Account deleted.'); await loadAccounts(); }
        catch (err) { toast(err.message); }
      }));
    }
    $('refresh-accounts')?.addEventListener('click', () => loadAccounts().catch((e) => toast(e.message)));
    submit('staff-form', async () => {
      const created = await api().post('/accounts', { role: value('staff-role'), fullName: value('staff-name'), username: value('staff-username'), email: value('staff-email'), password: value('staff-password') });
      toast(created.message || 'Staff account created. The staff member must verify their email before signing in.'); $('staff-form').reset(); await loadAccounts();
    });
    await loadAccounts();
  }

  async function resultsPage() {
    const elections = await api().get('/elections');
    const published = elections.filter((e) => e.status === 'Published');
    const electionSelect = $('result-election');
    const resultsForm = $('results-form');
    const submitButton = resultsForm?.querySelector('[type="submit"]');

    if (published.length === 0) {
      electionSelect.innerHTML = '<option value="">No elections</option>';
      electionSelect.disabled = true;
      electionSelect.required = false;
      if (submitButton) submitButton.disabled = true;
      $('result-summary').textContent = 'No elections have been published yet.';
      setRows('results-table', '', 'No elections have been published yet.', 4);
      return;
    }

    electionSelect.disabled = false;
    electionSelect.required = true;
    if (submitButton) submitButton.disabled = false;
    electionSelect.innerHTML = '<option value="">Select published election</option>' + options(published, (e) => `${e.name} (${dateLabel(e.election_date)})`);
    submit('results-form', async () => {
      const result = await api().get(`/results/${value('result-election')}`);
      const rows = result.results || [];
      const total = rows.reduce((sum, row) => sum + Number(row.vote_count || 0), 0);
      $('result-summary').textContent = `${result.election.name} · ${dateLabel(result.election.election_date || '')} · ${total} votes counted`;
      setRows('results-table', rows.map((r) => {
        const count = Number(r.vote_count || 0);
        const share = total ? `${(count * 100 / total).toFixed(1)}%` : '0.0%';
        return `<tr><td>${esc(r.candidate_name)}</td><td>${esc(r.party_name || 'Independent')}</td><td>${count}</td><td>${share}</td></tr>`;
      }).join(''), 'No vote records found for this election.', 4);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const current = location.pathname.split('/').pop();
      if (['voter.html', 'party.html', 'candidate.html', 'blo.html', 'election-officer.html', 'account.html'].includes(current)) {
        const user = await window.EMS_AUTH_READY;
        if (!user) return;
      }
      if (current === 'voter.html') await voterPage();
      else if (current === 'party.html') await partyPage();
      else if (current === 'candidate.html') await candidatePage();
      else if (current === 'blo.html') await applicationsPage('review-queue', 'BLO');
      else if (current === 'election-officer.html') await officerPage();
      else if (current === 'account.html') await accountPage();
      else if (current === 'results.html') await resultsPage();
    } catch (err) { toast(err.message); }
  });
})();
