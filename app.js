/* Depot-Tracker – Hauptlogik (Deutsch) */

(() => {
  'use strict';

  /* -------------------------------------------------- */
  /* Hilfsfunktionen                                   */
  /* -------------------------------------------------- */
  const formatEUR = (val) => new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(val);

  const formatPct = (val) => `${val.toFixed(2)}%`;

  const calcDays = (from, to) => {
    if (!from || !to) return 0;
    return Math.ceil((new Date(to) - new Date(from)) / 86_400_000);
  };

  /* -------------------------------------------------- */
  /* DOM Elemente                                       */
  /* -------------------------------------------------- */
  const dom = {
    form: document.getElementById('tradeForm'),
    tbody: document.getElementById('tbody'),
    stats: document.getElementById('stats'),
    banner: document.getElementById('editBanner'),
    saveBtn: document.getElementById('saveBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importFile: document.getElementById('importFile'),
    tableHeader: document.getElementById('tableHeader'),
  };

  /* -------------------------------------------------- */
  /* Anwendungs-State                                   */
  /* -------------------------------------------------- */
  let trades = loadFromStorage();

  let sortState = {
    key: null,
    dir: 'asc', // 'asc' | 'desc'
  };

  const mandatoryFields = ['datum', 'ticker', 'richtung', 'anzahl', 'einstiegspreis'];

  /* -------------------------------------------------- */
  /* LocalStorage Funktionen                            */
  /* -------------------------------------------------- */
  function saveToStorage() {
    try {
      localStorage.setItem('depot-tracker-trades', JSON.stringify(trades));
      console.log('Daten in localStorage gespeichert');
    } catch (err) {
      console.error('Fehler beim Speichern in localStorage:', err);
    }
  }

  function loadFromStorage() {
    try {
      const data = localStorage.getItem('depot-tracker-trades');
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Fehler beim Laden aus localStorage:', err);
      return [];
    }
  }

  /* -------------------------------------------------- */
  /* Formularhandling                                   */
  /* -------------------------------------------------- */
  dom.form.addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('Form submit ausgelöst');

    try {
      const trade = readForm();
      const editing = dom.form.editIndex.value !== '';
      const idx = editing ? Number(dom.form.editIndex.value) : -1;

      if (editing) {
        trades[idx] = trade;
        console.info(`Trade #${idx} aktualisiert`, trade);
      } else {
        trades.push(trade);
        console.info('Neuer Trade gespeichert', trade);
      }

      saveToStorage();
      exitEditMode();
      resetForm();
      render();
      
      // Erfolgsmeldung
      showMessage('Trade erfolgreich gespeichert!', 'success');
      
    } catch (err) {
      alert('Fehler: ' + err.message);
      console.error('Validierungsfehler', err);
    }
  });

  dom.cancelBtn.addEventListener('click', () => {
    exitEditMode();
    resetForm();
  });

  function resetForm() {
    dom.form.reset();
    // Explizit Standardwerte setzen
    dom.form.gebuehren.value = '0';
    dom.form.editIndex.value = '';
  }

  function readForm() {
    const f = dom.form;
    
    console.log('Form Werte beim Lesen:', {
      datum: f.datum.value,
      ticker: f.ticker.value,
      richtung: f.richtung.value,
      anzahl: f.anzahl.value,
      einstiegspreis: f.einstiegspreis.value,
      gebuehren: f.gebuehren.value
    });
    
    const data = {
      datum: f.datum.value,
      ticker: f.ticker.value.trim().toUpperCase(),
      richtung: f.richtung.value,
      anzahl: Number(f.anzahl.value),
      einstiegspreis: Number(f.einstiegspreis.value),
      gebuehren: Number(f.gebuehren.value) || 0,
      ausstiegsdatum: f.ausstiegsdatum.value,
      ausstiegspreis: f.ausstiegspreis.value ? Number(f.ausstiegspreis.value) : '',
      notizen: f.notizen.value.trim(),
    };

    // Pflichtfelder prüfen
    for (const key of mandatoryFields) {
      if (!data[key] && data[key] !== 0) {
        throw new Error(`Pflichtfeld "${key}" darf nicht leer sein.`);
      }
    }

    if ((data.ausstiegsdatum && !data.ausstiegspreis) || (!data.ausstiegsdatum && data.ausstiegspreis !== '')) {
      throw new Error('Ausstiegsdatum und Ausstiegspreis müssen gemeinsam angegeben werden.');
    }

    if (data.anzahl <= 0) throw new Error('Anzahl muss größer als 0 sein.');
    if (data.einstiegspreis <= 0) throw new Error('Einstiegspreis muss größer als 0 sein.');

    return data;
  }

  function showMessage(text, type = 'info') {
    // Einfache Nachricht anzeigen
    const msg = document.createElement('div');
    msg.className = `status status--${type}`;
    msg.textContent = text;
    msg.style.position = 'fixed';
    msg.style.top = '20px';
    msg.style.right = '20px';
    msg.style.zIndex = '1000';
    document.body.appendChild(msg);
    
    setTimeout(() => {
      if (msg.parentNode) msg.parentNode.removeChild(msg);
    }, 3000);
  }

  /* -------------------------------------------------- */
  /* Tabellen-Rendering                                 */
  /* -------------------------------------------------- */
  function render() {
    renderTable();
    renderStats();
  }

  function renderTable() {
    dom.tbody.innerHTML = '';

    if (trades.length === 0) {
      dom.tbody.innerHTML = `<tr><td colspan="14" style="text-align:center;font-style:italic;">Keine Trades vorhanden</td></tr>`;
      return;
    }

    // Sortieren
    let rows = [...trades];
    if (sortState.key) {
      rows.sort((a, b) => {
        const valA = getSortVal(a, sortState.key);
        const valB = getSortVal(b, sortState.key);
        if (valA < valB) return sortState.dir === 'asc' ? -1 : 1;
        if (valA > valB) return sortState.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    rows.forEach((t, i) => {
      const idx = trades.indexOf(t); // Original Index für Aktionen
      const row = dom.tbody.insertRow();
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => enterEditMode(idx));

      const profit = calcProfit(t);
      const profitPct = calcProfitPct(t);
      const gehalten = t.ausstiegspreis !== '' ? calcDays(t.datum, t.ausstiegsdatum) : 'offen';

      row.innerHTML = `
        <td>${idx + 1}</td>
        <td>${t.datum}</td>
        <td><strong>${t.ticker}</strong></td>
        <td>${t.richtung}</td>
        <td>${t.anzahl}</td>
        <td>${formatEUR(t.einstiegspreis)}</td>
        <td class="col--optional">${t.ausstiegsdatum || 'offen'}</td>
        <td class="col--optional">${t.ausstiegspreis !== '' ? formatEUR(t.ausstiegspreis) : 'offen'}</td>
        <td style="color: ${profit > 0 ? 'green' : profit < 0 ? 'red' : 'inherit'}">${t.ausstiegspreis !== '' ? formatEUR(profit) : 'offen'}</td>
        <td style="color: ${profitPct > 0 ? 'green' : profitPct < 0 ? 'red' : 'inherit'}">${t.ausstiegspreis !== '' ? formatPct(profitPct) : 'offen'}</td>
        <td class="col--optional">${gehalten}</td>
        <td>${formatEUR(t.gebuehren)}</td>
        <td class="col--optional" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${t.notizen}</td>
        <td style="white-space: nowrap;">
          <button class="btn btn--secondary btn--sm" data-action="edit" style="margin-right: 4px;">Bearbeiten</button>
          <button class="btn btn-delete btn--sm" data-action="delete">Löschen</button>
        </td>`;

      // Event Listeners für Buttons
      const editBtn = row.querySelector('[data-action="edit"]');
      const delBtn = row.querySelector('[data-action="delete"]');
      
      editBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        enterEditMode(idx);
      });
      
      delBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        deleteTrade(idx);
      });
    });
  }

  function getSortVal(obj, key) {
    if (key === 'pl') return calcProfit(obj);
    if (key === 'plpct') return calcProfitPct(obj);
    if (key === 'tage') return calcDays(obj.datum, obj.ausstiegsdatum);
    if (key === 'index') return trades.indexOf(obj);
    return obj[key] ?? '';
  }

  /* -------------------------------------------------- */
  /* Gewinn/Verlust                                     */
  /* -------------------------------------------------- */
  const calcProfit = (t) =>
    t.ausstiegspreis !== ''
      ? (t.ausstiegspreis - t.einstiegspreis) * t.anzahl - t.gebuehren
      : 0;

  const calcProfitPct = (t) =>
    t.ausstiegspreis !== ''
      ? ((t.ausstiegspreis - t.einstiegspreis) / t.einstiegspreis) * 100
      : 0;

  /* -------------------------------------------------- */
  /* Statistik-Rendering                                */
  /* -------------------------------------------------- */
  function renderStats() {
    const closed = trades.filter((t) => t.ausstiegspreis !== '');
    const wins = closed.filter((t) => calcProfit(t) > 0);
    const losses = closed.filter((t) => calcProfit(t) < 0);

    const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

    const totalProfit = closed.reduce((sum, t) => sum + calcProfit(t), 0);
    const avgDaysHeld = avg(closed.map((t) => calcDays(t.datum, t.ausstiegsdatum)));
    const avgStake = avg(trades.map((t) => t.einstiegspreis * t.anzahl));
    const maxWin = wins.length ? Math.max(...wins.map(calcProfit)) : 0;
    const maxLoss = losses.length ? Math.min(...losses.map(calcProfit)) : 0;

    dom.stats.innerHTML = `
      <div class="stat"><strong>${trades.length}</strong><br/>Gesamt Trades</div>
      <div class="stat"><strong>${formatPct(closed.length ? (wins.length / closed.length) * 100 : 0)}</strong><br/>Gewinn-%</div>
      <div class="stat"><strong>${formatPct(avg(wins.map(calcProfitPct)))}</strong><br/>Ø Gewinn %</div>
      <div class="stat"><strong>${formatPct(avg(losses.map(calcProfitPct)))}</strong><br/>Ø Verlust %</div>
      <div class="stat"><strong>${formatEUR(maxWin)}</strong><br/>Größter Gewinn</div>
      <div class="stat"><strong>${formatEUR(maxLoss)}</strong><br/>Größter Verlust</div>
      <div class="stat"><strong>${avgDaysHeld.toFixed(1)}</strong><br/>Ø Tage gehalten</div>
      <div class="stat"><strong>${formatEUR(avgStake)}</strong><br/>Ø Einsatz</div>`;
  }

  /* -------------------------------------------------- */
  /* Edit / Delete                                      */
  /* -------------------------------------------------- */
  function enterEditMode(idx) {
    const t = trades[idx];
    const f = dom.form;

    console.log('Betrete Bearbeitungsmodus für Trade:', t);

    f.editIndex.value = idx;
    f.datum.value = t.datum;
    f.ticker.value = t.ticker;
    f.richtung.value = t.richtung;
    f.anzahl.value = t.anzahl;
    f.einstiegspreis.value = t.einstiegspreis;
    f.gebuehren.value = t.gebuehren;
    f.ausstiegsdatum.value = t.ausstiegsdatum;
    f.ausstiegspreis.value = t.ausstiegspreis !== '' ? t.ausstiegspreis : '';
    f.notizen.value = t.notizen;

    dom.banner.classList.remove('hidden');
    dom.cancelBtn.classList.remove('hidden');
    dom.saveBtn.textContent = 'Aktualisieren';
    
    // Scroll zum Formular
    dom.form.scrollIntoView({ behavior: 'smooth' });
  }

  function exitEditMode() {
    dom.form.editIndex.value = '';
    dom.banner.classList.add('hidden');
    dom.cancelBtn.classList.add('hidden');
    dom.saveBtn.textContent = 'Trade hinzufügen';
  }

  function deleteTrade(idx) {
    if (!confirm('Möchtest du diesen Trade wirklich löschen?')) return;
    trades.splice(idx, 1);
    saveToStorage();
    exitEditMode();
    render();
    showMessage('Trade gelöscht', 'info');
  }

  /* -------------------------------------------------- */
  /* Sortierbare Spalten                                */
  /* -------------------------------------------------- */
  dom.tableHeader.addEventListener('click', (ev) => {
    const th = ev.target.closest('th');
    if (!th || !th.dataset.key) return;

    const key = th.dataset.key;
    if (sortState.key === key) {
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState.key = key;
      sortState.dir = 'asc';
    }

    // Klassen aktualisieren
    [...dom.tableHeader.children].forEach((c) => c.classList.remove('th--sorted-asc', 'th--sorted-desc'));
    th.classList.add(sortState.dir === 'asc' ? 'th--sorted-asc' : 'th--sorted-desc');

    renderTable();
  });

  /* -------------------------------------------------- */
  /* Import / Export                                    */
  /* -------------------------------------------------- */
  dom.exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(trades, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depot-trades-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('Daten exportiert', 'success');
  });

  dom.importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (!Array.isArray(parsed)) throw new Error('Ungültiges Format – Array erwartet.');
        trades = parsed;
        saveToStorage();
        exitEditMode();
        resetForm();
        render();
        showMessage('Daten erfolgreich importiert', 'success');
        console.info('Daten erfolgreich importiert');
      } catch (err) {
        alert('Importfehler: ' + err.message);
        console.error('Importfehler', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  /* -------------------------------------------------- */
  /* Initial Setup                                      */
  /* -------------------------------------------------- */
  function init() {
    // Aktuelles Datum als Standard setzen
    const today = new Date().toISOString().split('T')[0];
    dom.form.datum.value = today;
    
    render();
    console.log('Depot-Tracker initialisiert. Trades geladen:', trades.length);
  }

  // Starten
  init();
})();