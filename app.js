/**
 * Depot-Tracker - Korrigierte JavaScript-Logik
 * Behebt alle Trade-Eingabe und Import/Export Probleme
 */

class DepotTracker {
  constructor() {
    this.trades = [];
    this.currentFilter = 'alle';
    this.editId = null;
    this.sortColumn = 'datum';
    this.sortDirection = 'desc';

    // Daten aus localStorage laden
    this.loadData();
    
    // UI initialisieren
    this.bindEvents();
    this.refreshFilterOptions();
    this.refreshStats();
    this.renderTable();

    // Globale Referenz für Inline-Handler
    window.depotTracker = this;
  }

  /* ------------- Event Binding ------------- */
  bindEvents() {
    // Formular Events
    const form = document.getElementById('tradeForm');
    form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    
    document.getElementById('cancelEdit').addEventListener('click', () => this.cancelEdit());
    
    // Import/Export Events
    document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importInput').click();
    });
    document.getElementById('importInput').addEventListener('change', (e) => this.importData(e));
    
    // Filter Event
    document.getElementById('monthFilter').addEventListener('change', (e) => {
      this.currentFilter = e.target.value;
      this.refreshStats();
      this.renderTable();
    });

    // Sortierung Events - nachdem Tabelle gerendert wurde
    this.bindSortingEvents();
  }

  bindSortingEvents() {
    document.querySelectorAll('[data-sort]').forEach(th => {
      th.addEventListener('click', (e) => {
        e.preventDefault();
        this.sortTable(th.dataset.sort);
      });
    });
  }

  /* ------------- Daten-Persistierung ------------- */
  saveData() {
    try {
      const data = {
        trades: this.trades,
        version: '1.0',
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('depot-tracker-data', JSON.stringify(data));
    } catch (error) {
      console.warn('Daten konnten nicht gespeichert werden:', error);
    }
  }

  loadData() {
    try {
      const saved = localStorage.getItem('depot-tracker-data');
      if (saved) {
        const data = JSON.parse(saved);
        this.trades = Array.isArray(data.trades) ? data.trades : [];
      }
    } catch (error) {
      console.warn('Daten konnten nicht geladen werden:', error);
      this.trades = [];
    }
  }

  /* ------------- Trade Management ------------- */
  handleFormSubmit(e) {
    e.preventDefault();
    
    const trade = this.createTradeFromForm();
    
    if (!this.validateTrade(trade)) {
      return;
    }

    if (this.editId) {
      this.updateTrade(trade);
    } else {
      this.addTrade(trade);
    }

    this.saveData();
    this.resetForm();
    this.refreshAll();
    this.showMessage('Trade erfolgreich gespeichert!', 'success');
  }

  createTradeFromForm() {
    const safeParseFloat = (value) => {
      if (!value || value === '') return null;
      const num = parseFloat(String(value).replace(',', '.'));
      return isNaN(num) ? null : num;
    };

    const safeParseInt = (value) => {
      if (!value || value === '') return null;
      const num = parseInt(value, 10);
      return isNaN(num) ? null : num;
    };

    // Direkt die Werte aus den Feldern holen
    const datum = document.getElementById('datum').value;
    const ticker = document.getElementById('ticker').value.trim().toUpperCase();
    const richtung = document.getElementById('richtung').value;
    const anzahl = safeParseInt(document.getElementById('anzahl').value);
    const einstiegspreis = safeParseFloat(document.getElementById('einstiegspreis').value);
    const gebuehren = safeParseFloat(document.getElementById('gebuehren').value) || 0;
    const ausstiegsdatum = document.getElementById('ausstiegsdatum').value || null;
    const ausstiegspreis = safeParseFloat(document.getElementById('ausstiegspreis').value) || null;
    const notizen = document.getElementById('notizen').value.trim();

    return {
      id: this.editId || this.generateId(),
      datum,
      ticker,
      richtung,
      anzahl,
      einstiegspreis,
      gebuehren,
      ausstiegsdatum,
      ausstiegspreis,
      notizen
    };
  }

  validateTrade(trade) {
    if (!trade.datum || !trade.ticker || !trade.richtung || !trade.anzahl || !trade.einstiegspreis) {
      this.showMessage('Bitte füllen Sie alle Pflichtfelder aus.', 'error');
      return false;
    }

    if (trade.anzahl <= 0 || trade.einstiegspreis <= 0) {
      this.showMessage('Anzahl und Einstiegspreis müssen größer als 0 sein.', 'error');
      return false;
    }

    if (trade.ausstiegsdatum && !trade.ausstiegspreis) {
      this.showMessage('Wenn ein Ausstiegsdatum angegeben ist, muss auch ein Ausstiegspreis eingegeben werden.', 'error');
      return false;
    }

    if (trade.ausstiegsdatum && new Date(trade.ausstiegsdatum) < new Date(trade.datum)) {
      this.showMessage('Das Ausstiegsdatum kann nicht vor dem Einstiegsdatum liegen.', 'error');
      return false;
    }

    return true;
  }

  addTrade(trade) {
    this.trades.push(trade);
  }

  updateTrade(trade) {
    const index = this.trades.findIndex(t => t.id === this.editId);
    if (index !== -1) {
      this.trades[index] = trade;
    }
  }

  editTrade(id) {
    const trade = this.trades.find(t => t.id === id);
    if (!trade) return;

    this.editId = id;
    this.populateForm(trade);
    
    document.getElementById('formTitle').textContent = 'Trade bearbeiten';
    document.getElementById('submitText').textContent = 'Trade aktualisieren';
    document.getElementById('cancelEdit').classList.remove('hidden');
    
    // Zum Formular scrollen
    document.getElementById('tradeForm').scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    });
  }

  deleteTrade(id) {
    if (!confirm('Sind Sie sicher, dass Sie diesen Trade löschen möchten?')) {
      return;
    }

    this.trades = this.trades.filter(t => t.id !== id);
    this.saveData();
    this.refreshAll();
    this.showMessage('Trade wurde gelöscht.', 'success');
  }

  populateForm(trade) {
    document.getElementById('datum').value = trade.datum;
    document.getElementById('ticker').value = trade.ticker;
    document.getElementById('richtung').value = trade.richtung;
    document.getElementById('anzahl').value = trade.anzahl;
    document.getElementById('einstiegspreis').value = trade.einstiegspreis;
    document.getElementById('gebuehren').value = trade.gebuehren;
    document.getElementById('ausstiegsdatum').value = trade.ausstiegsdatum || '';
    document.getElementById('ausstiegspreis').value = trade.ausstiegspreis || '';
    document.getElementById('notizen').value = trade.notizen;
  }

  resetForm() {
    document.getElementById('tradeForm').reset();
    this.editId = null;
    document.getElementById('formTitle').textContent = 'Trade eingeben';
    document.getElementById('submitText').textContent = 'Trade hinzufügen';
    document.getElementById('cancelEdit').classList.add('hidden');
    
    // Setze das Standard-Datum auf heute
    document.getElementById('datum').value = new Date().toISOString().split('T')[0];
  }

  cancelEdit() {
    this.resetForm();
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  /* ------------- Filterung und Sortierung ------------- */
  refreshFilterOptions() {
    const select = document.getElementById('monthFilter');
    const months = new Set();
    
    this.trades.forEach(trade => {
      const date = new Date(trade.datum);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthKey);
    });

    const sortedMonths = Array.from(months).sort().reverse();
    
    let html = '<option value="alle">Alle Monate</option>';
    sortedMonths.forEach(monthKey => {
      const [year, month] = monthKey.split('-');
      const date = new Date(year, month - 1);
      const label = date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      html += `<option value="${monthKey}">${label}</option>`;
    });

    select.innerHTML = html;
    select.value = this.currentFilter;
  }

  getFilteredTrades() {
    if (this.currentFilter === 'alle') {
      return this.trades;
    }

    return this.trades.filter(trade => {
      const date = new Date(trade.datum);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return monthKey === this.currentFilter;
    });
  }

  getCompletedTrades() {
    return this.getFilteredTrades().filter(trade => 
      trade.ausstiegsdatum && trade.ausstiegspreis !== null
    );
  }

  sortTable(column) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'desc';
    }
    this.renderTable();
  }

  /* ------------- Statistiken ------------- */
  calculateTradeMetrics(trade) {
    if (!trade.ausstiegsdatum || trade.ausstiegspreis === null) {
      return null;
    }

    const investment = trade.einstiegspreis * trade.anzahl + trade.gebuehren;
    const proceeds = trade.ausstiegspreis * trade.anzahl;
    const profit = proceeds - investment;
    const profitPercent = (profit / investment) * 100;
    
    const entryDate = new Date(trade.datum);
    const exitDate = new Date(trade.ausstiegsdatum);
    const daysHeld = Math.ceil((exitDate - entryDate) / (1000 * 60 * 60 * 24));

    return {
      profit,
      profitPercent,
      daysHeld,
      investment
    };
  }

  refreshStats() {
    const completedTrades = this.getCompletedTrades();
    const metrics = completedTrades.map(trade => this.calculateTradeMetrics(trade)).filter(Boolean);

    const winningTrades = metrics.filter(m => m.profit > 0);
    const losingTrades = metrics.filter(m => m.profit < 0);

    const stats = this.calculateStatistics(metrics, winningTrades, losingTrades);
    this.renderStats(stats);
  }

  calculateStatistics(allMetrics, winningTrades, losingTrades) {
    const totalTrades = allMetrics.length;
    const winRate = totalTrades ? (winningTrades.length / totalTrades) * 100 : 0;
    
    const avgWinPercent = winningTrades.length ? 
      winningTrades.reduce((sum, m) => sum + m.profitPercent, 0) / winningTrades.length : 0;
    
    const avgWinDays = winningTrades.length ?
      winningTrades.reduce((sum, m) => sum + m.daysHeld, 0) / winningTrades.length : 0;
    
    const avgLossPercent = losingTrades.length ?
      losingTrades.reduce((sum, m) => sum + m.profitPercent, 0) / losingTrades.length : 0;
    
    const avgLossDays = losingTrades.length ?
      losingTrades.reduce((sum, m) => sum + m.daysHeld, 0) / losingTrades.length : 0;
    
    const maxProfit = winningTrades.length ? Math.max(...winningTrades.map(m => m.profit)) : 0;
    const maxLoss = losingTrades.length ? Math.min(...losingTrades.map(m => m.profit)) : 0;
    
    const avgInvestment = allMetrics.length ?
      allMetrics.reduce((sum, m) => sum + m.investment, 0) / allMetrics.length : 0;
    
    const expectedValue = (winRate / 100) * avgWinPercent + ((100 - winRate) / 100) * avgLossPercent;
    const expectedValueEuro = (expectedValue * avgInvestment) / 100;

    return {
      totalTrades,
      winRate,
      avgWinPercent,
      avgWinDays,
      avgLossPercent,
      avgLossDays,
      maxProfit,
      maxLoss,
      avgInvestment,
      expectedValueEuro
    };
  }

  renderStats(stats) {
    const container = document.getElementById('stats');
    
    const statsData = [
      { label: 'Gesamttrades', value: stats.totalTrades, type: 'number' },
      { label: 'Gewinn %', value: stats.winRate, type: 'percent', colored: true },
      { label: 'Durchschnitts Gewinn %', value: stats.avgWinPercent, type: 'percent', colored: true },
      { label: 'Durchschnitt Gewinn Tage gehalten', value: stats.avgWinDays, type: 'days' },
      { label: 'Durchschnitts Verlust %', value: stats.avgLossPercent, type: 'percent', colored: true },
      { label: 'Durchschnitt Verlust Tage gehalten', value: stats.avgLossDays, type: 'days' },
      { label: 'Größter Gewinn', value: stats.maxProfit, type: 'currency', colored: true },
      { label: 'Größter Verlust', value: stats.maxLoss, type: 'currency', colored: true },
      { label: 'Durchschnitts Einsatz', value: stats.avgInvestment, type: 'currency' },
      { label: 'Erwartungswert pro Trade', value: stats.expectedValueEuro, type: 'currency', colored: true }
    ];

    container.innerHTML = statsData.map(stat => {
      const formattedValue = this.formatStatValue(stat.value, stat.type);
      const colorClass = stat.colored ? this.getValueColorClass(stat.value) : '';
      
      return `
        <div class="stat-card">
          <div class="stat-card__label">${stat.label}</div>
          <div class="stat-card__value ${colorClass}">${formattedValue}</div>
        </div>
      `;
    }).join('');
  }

  formatStatValue(value, type) {
    if (value === 0 || value === null || isNaN(value)) {
      return type === 'percent' ? '0,00%' :
             type === 'currency' ? '0,00€' :
             type === 'days' ? '0 Tage' : '0';
    }

    switch (type) {
      case 'percent':
        return value.toFixed(2).replace('.', ',') + '%';
      case 'currency':
        return value.toFixed(2).replace('.', ',') + '€';
      case 'days':
        return Math.round(value) + ' Tage';
      default:
        return Math.round(value).toString();
    }
  }

  getValueColorClass(value) {
    if (value > 0) return 'stat-card__value--positive';
    if (value < 0) return 'stat-card__value--negative';
    return '';
  }

  /* ------------- Tabellen-Rendering ------------- */
  renderTable() {
    const tbody = document.querySelector('#tradeTable tbody');
    const trades = this.getSortedTrades();

    if (trades.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-state">
            <h3>Keine Trades vorhanden</h3>
            <p>Fügen Sie Ihren ersten Trade über das Formular hinzu.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = trades.map(trade => this.createTableRow(trade)).join('');
  }

  getSortedTrades() {
    const trades = [...this.getFilteredTrades()];
    
    trades.sort((a, b) => {
      let aVal = a[this.sortColumn];
      let bVal = b[this.sortColumn];

      // Handle special sorting cases
      if (this.sortColumn === 'rendite') {
        const aMetrics = this.calculateTradeMetrics(a);
        const bMetrics = this.calculateTradeMetrics(b);
        aVal = aMetrics ? aMetrics.profitPercent : -Infinity;
        bVal = bMetrics ? bMetrics.profitPercent : -Infinity;
      }

      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (this.sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return trades;
  }

  createTableRow(trade) {
    const metrics = this.calculateTradeMetrics(trade);
    const rowClass = this.getRowClass(metrics);
    const profitCell = this.createProfitCell(metrics);

    return `
      <tr class="${rowClass}" onclick="depotTracker.editTrade('${trade.id}')">
        <td>${this.formatDate(trade.datum)}</td>
        <td><strong>${trade.ticker}</strong></td>
        <td>${trade.richtung}</td>
        <td>${trade.anzahl}</td>
        <td>${trade.einstiegspreis.toFixed(2).replace('.', ',')}€</td>
        <td>${trade.gebuehren.toFixed(2).replace('.', ',')}€</td>
        <td>${trade.ausstiegsdatum ? this.formatDate(trade.ausstiegsdatum) : '-'}</td>
        <td>${trade.ausstiegspreis ? trade.ausstiegspreis.toFixed(2).replace('.', ',') + '€' : '-'}</td>
        <td>${profitCell}</td>
        <td class="action-buttons" onclick="event.stopPropagation()">
          <button class="btn btn--xs btn--edit" onclick="depotTracker.editTrade('${trade.id}')">
            Editieren
          </button>
          <button class="btn btn--xs btn--delete" onclick="depotTracker.deleteTrade('${trade.id}')">
            Löschen
          </button>
        </td>
      </tr>
    `;
  }

  getRowClass(metrics) {
    if (!metrics) return 'trade-row--open';
    return metrics.profit > 0 ? 'trade-row--profit' : 'trade-row--loss';
  }

  createProfitCell(metrics) {
    if (!metrics) {
      return '<span class="neutral">Offen</span>';
    }
    
    const className = metrics.profit > 0 ? 'profit' : 'loss';
    const formattedPercent = metrics.profitPercent.toFixed(2).replace('.', ',');
    return `<span class="${className}">${formattedPercent}%</span>`;
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('de-DE');
  }

  /* ------------- Import/Export ------------- */
  exportData() {
    try {
      if (this.trades.length === 0) {
        this.showMessage('Keine Trades zum Exportieren vorhanden.', 'error');
        return;
      }

      const data = {
        trades: this.trades,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };

      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `depot-trades-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.showMessage('Daten erfolgreich exportiert!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showMessage('Export fehlgeschlagen: ' + error.message, 'error');
    }
  }

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (!data.trades || !Array.isArray(data.trades)) {
          throw new Error('Ungültiges Dateiformat: trades Array fehlt');
        }

        // Duplikate vermeiden
        const existingIds = new Set(this.trades.map(t => t.id));
        let newTrades = data.trades.filter(trade => !existingIds.has(trade.id));
        
        // Ensure alle Trades haben IDs
        newTrades = newTrades.map(trade => ({
          ...trade,
          id: trade.id || this.generateId()
        }));
        
        this.trades.push(...newTrades);
        this.saveData();
        this.refreshAll();
        
        this.showMessage(`${newTrades.length} Trades erfolgreich importiert!`, 'success');
      } catch (error) {
        console.error('Import failed:', error);
        this.showMessage('Import fehlgeschlagen: ' + error.message, 'error');
      }
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  }

  /* ------------- Hilfsfunktionen ------------- */
  refreshAll() {
    this.refreshFilterOptions();
    this.refreshStats();
    this.renderTable();
    this.bindSortingEvents(); // Re-bind nach Tabellen-Rendering
  }

  showMessage(text, type) {
    // Remove existing messages
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
      existingMessage.remove();
    }

    const message = document.createElement('div');
    message.className = `message message--${type}`;
    message.textContent = text;

    const main = document.querySelector('main');
    main.insertBefore(message, main.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.remove();
      }
    }, 5000);
  }
}

// App starten
document.addEventListener('DOMContentLoaded', () => {
  new DepotTracker();
});