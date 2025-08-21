let foods = [];
let availableFoods = [];
let editingEntry = null;
let showingAll = false;

async function loadFoods() {
  const res = await fetch('/api/foods');
  foods = await res.json();
  const list = document.getElementById('all-foods');
  list.innerHTML = '';
  foods.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f.name;
    list.appendChild(opt);
  });
}

async function loadAvailable() {
  const res = await fetch('/api/available');
  availableFoods = await res.json();
  const container = document.getElementById('availableFoods');
  container.innerHTML = '';
  availableFoods.forEach((f) => {
    const btn = document.createElement('button');
    btn.textContent = f.name;
    btn.onclick = () => openEntryForm(f);
    container.appendChild(btn);
  });
}

function openEntryForm(food, entry) {
  editingEntry = entry || null;
  document.getElementById('selectedFood').textContent = food.name;
  document.getElementById('entryForm').classList.remove('hidden');
  const now = entry ? new Date(entry.date) : new Date();
  document.getElementById('dateInput').value = now.toISOString().split('T')[0];
  document.getElementById('timeInput').value = now.toISOString().slice(11,16);
  document.getElementById('removeBtn').classList.toggle('hidden', !entry);
  document.getElementById('confirmBtn').onclick = () => submitEntry(food);
}

function closeEntryForm() {
  document.getElementById('entryForm').classList.add('hidden');
  editingEntry = null;
}

document.getElementById('cancelBtn').onclick = closeEntryForm;
document.getElementById('removeBtn').onclick = async () => {
  if (!editingEntry) return;
  await fetch('/api/entries/' + editingEntry.id, { method: 'DELETE' });
  closeEntryForm();
  await refreshAll();
};

async function submitEntry(food) {
  const date = document.getElementById('dateInput').value;
  const time = document.getElementById('timeInput').value;
  if (!date || !time) return;
  if (editingEntry) {
    await fetch('/api/entries/' + editingEntry.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time })
    });
  } else {
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodId: food.id, date, time })
    });
  }
  closeEntryForm();
  await refreshAll();
}

async function loadSchedule() {
  const container = document.getElementById('schedule');
  container.innerHTML = '';
  let url = '/api/entries';
  if (!showingAll) {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    url += '?since=' + d.toISOString().split('T')[0];
  }
  const res = await fetch(url);
  const entries = await res.json();
  let currentDate = '';
  entries.forEach((e) => {
    const d = new Date(e.date);
    const dayStr = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (dayStr !== currentDate) {
      currentDate = dayStr;
      const h = document.createElement('h3');
      h.textContent = dayStr;
      container.appendChild(h);
    }
    const item = document.createElement('div');
    item.textContent = e.food_name;
    item.className = 'schedule-entry';
    item.onclick = () => openEntryForm({ id: e.food_id, name: e.food_name }, e);
    container.appendChild(item);
  });
}

async function loadNextList() {
  const res = await fetch('/api/foods/next');
  const list = await res.json();
  const container = document.getElementById('nextList');
  container.innerHTML = '';
  const today = new Date();
  const groups = {};
  list.forEach((f) => {
    const next = new Date(f.next_available);
    const diff = Math.ceil((next - new Date(today.toDateString())) / (1000*60*60*24));
    const label = diff <= 0 ? 'Available today' : diff === 1 ? 'Available in 1 day' : `Available in ${diff} days`;
    groups[label] = groups[label] || [];
    groups[label].push(f);
  });
  Object.keys(groups).sort().forEach((label) => {
    const div = document.createElement('div');
    div.className = 'group';
    const h = document.createElement('h3');
    h.textContent = label;
    div.appendChild(h);
    groups[label].forEach((f) => {
      const btn = document.createElement('button');
      btn.textContent = f.name;
      btn.onclick = () => manageFood(f);
      div.appendChild(btn);
    });
    container.appendChild(div);
  });
}

async function manageFood(food) {
  const choice = prompt('Edit name or type DELETE to remove', food.name);
  if (choice === null) return;
  if (choice === 'DELETE') {
    const also = confirm('Also delete existing entries? OK = delete entries, Cancel = keep entries');
    await fetch(`/api/foods/${food.id}?removeEntries=${also}`, { method: 'DELETE' });
  } else if (choice.trim() && choice.trim() !== food.name) {
    await fetch('/api/foods/' + food.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: choice.trim() })
    });
  }
  await refreshAll();
}

document.getElementById('toggleScheduleBtn').onclick = () => {
  showingAll = !showingAll;
  document.getElementById('toggleScheduleBtn').textContent = showingAll ? 'Show recent entries' : 'Show all entries';
  loadSchedule();
};

document.getElementById('newFoodInput').addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const name = e.target.value.trim();
    if (!name) return;
    const exists = foods.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    await fetch('/api/foods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    e.target.value = '';
    await refreshAll();
  }
});

async function refreshAll() {
  await loadFoods();
  await loadAvailable();
  await loadSchedule();
  await loadNextList();
}

window.addEventListener('DOMContentLoaded', refreshAll);
