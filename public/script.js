async function fetchFoods() {
  const res = await fetch('/api/foods');
  const foods = await res.json();
  const datalist = document.getElementById('food-suggestions');
  datalist.innerHTML = '';
  foods.forEach((f) => {
    const option = document.createElement('option');
    option.value = f.name;
    datalist.appendChild(option);
  });
  renderFoodList(foods);
}

async function addEntry() {
  const input = document.getElementById('foodInput');
  const name = input.value.trim();
  if (!name) return;
  const foods = await fetch('/api/foods').then((r) => r.json());
  let food = foods.find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (!food) {
    if (!confirm(`"${name}" not found. Add as new food?`)) return;
    const res = await fetch('/api/foods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      alert('Could not add food');
      return;
    }
    food = await res.json();
    await fetchFoods();
  }
  await fetch('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ foodId: food.id })
  });
  input.value = '';
  refreshSummary();
}

document.getElementById('entryForm').addEventListener('submit', (e) => {
  e.preventDefault();
  addEntry();
});

async function refreshSummary() {
  const res = await fetch('/api/summary');
  const data = await res.json();
  const container = document.getElementById('summaryList');
  container.innerHTML = '';
  data.forEach((e) => {
    const div = document.createElement('div');
    const date = new Date(e.date).toLocaleString();
    div.textContent = `${date}: ${e.food_name}`;
    div.className = e.repeated ? 'repeated' : 'unique';
    container.appendChild(div);
  });
}

async function renderFoodList(foods) {
  const list = document.getElementById('foodList');
  list.innerHTML = '';
  foods.forEach((f) => {
    const li = document.createElement('li');
    li.textContent = f.name + ' ';
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.onclick = async () => {
      const newName = prompt('New name', f.name);
      if (!newName) return;
      const res = await fetch('/api/foods/' + f.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        await fetchFoods();
        refreshSummary();
      } else {
        alert('Rename failed');
      }
    };
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.onclick = async () => {
      if (!confirm(`Delete "${f.name}"?`)) return;
      const alsoDel = confirm('Also delete existing entries? OK = delete entries, Cancel = keep entries');
      await fetch('/api/foods/' + f.id + '?removeEntries=' + alsoDel, { method: 'DELETE' });
      await fetchFoods();
      refreshSummary();
    };
    li.appendChild(editBtn);
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  fetchFoods();
  refreshSummary();
});
