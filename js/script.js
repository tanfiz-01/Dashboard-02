document.addEventListener('DOMContentLoaded', function () {
    async function main() {
        try {
            // Fetch data from the JSON file. 'await' pauses the function until the file is loaded.
            const response = await fetch('data.json');
            // If the file can't be found or there's an error, throw an error to be caught later.
            if (!response.ok) {
                throw new Error(`Failed to load data.json: ${response.statusText}`);
            }
            const appData = await response.json();
            
            // Now that data is loaded, run all the functions to build the dashboard.
            initializeApp(appData.species, appData.recommendations);

        } catch (error) {
            // If anything goes wrong during fetching, log the error and show a message to the user.
            console.error("Could not initialize the application:", error);
            const explorer = document.getElementById('explorer');
            if(explorer) {
                explorer.innerHTML = `<p class="text-center text-red-600 font-semibold">Error: Could not load commodity data. Please check the console for details.</p>`;
            }
        }
    }

    // This function contains all the logic and event listeners for the dashboard.
    function initializeApp(speciesData, recommendationsData) {
        // --- GLOBAL VARIABLES & ELEMENT REFERENCES ---
        Chart.register(ChartDataLabels); // Register Chart.js plugin
        const speciesGrid = document.getElementById('speciesGrid');
        const categoryFilterButton = document.getElementById('categoryFilterButton');
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        const linkageFilterGroup = document.getElementById('linkageFilterGroup');
        const stateFilterGroup = document.getElementById('stateFilterGroup');
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const closeModalBtn = document.getElementById('closeModal');
        const accordionContainer = document.getElementById('accordion');
        const speciesCountEl = document.getElementById('speciesCount');
        const backwardLinkagePercentEl = document.getElementById('backwardLinkagePercent');
        const forwardLinkagePercentEl = document.getElementById('forwardLinkagePercent');
        const integratedLinkagePercentEl = document.getElementById('integratedLinkagePercent');
        let modalChart = null;

        // --- HELPER FUNCTIONS ---
        function getLinkageIcon(linkage) {
            if (linkage === 'Backward') return { icon: '⬅️', color: 'bg-red-100 text-red-800', tooltip: 'Backward Linkage: Focus on supply, cultivation, and collection.' };
            if (linkage === 'Forward') return { icon: '➡️', color: 'bg-green-100 text-green-800', tooltip: 'Forward Linkage: Focus on processing, branding, and market access.' };
            return { icon: '⬅️➡️', color: 'bg-blue-100 text-blue-800', tooltip: 'Integrated Linkage: Requires focus on both supply and market sides.' };
        }
        
        function renderSpecies(filteredData) {
            speciesGrid.innerHTML = '';
            document.getElementById('resultsCount').textContent = `${filteredData.length} Species Found`;
            const sortedData = filteredData.sort((a, b) => a.name.localeCompare(b.name));

            // Get the template from the HTML
            const template = document.getElementById('species-card-template');

            sortedData.forEach(species => {
                // Create a new card by cloning the template
                const card = template.content.cloneNode(true);
                const linkageInfo = getLinkageIcon(species.linkage);

                const imageEl = card.querySelector('.image');
                imageEl.src = species.image;
                imageEl.alt = species.name;

                imageEl.onerror = () => {
                    imageEl.src = `https://placehold.co/600x400/e2e8f0/64748b?text=${species.name.replace(/ /g, '+')}`;
                };

                const linkageIconEl = card.querySelector('.linkage-icon');
                linkageIconEl.title = linkageInfo.tooltip;
                linkageIconEl.textContent = linkageInfo.icon;
                linkageIconEl.classList.add(...linkageInfo.color.split(' '));

                card.querySelector('.species-name').textContent = species.name;
                card.querySelector('.botanical-name').textContent = species.botanical;
                card.querySelector('.strength').textContent = species.strength;

                const linkageTagEl = card.querySelector('.linkage-tag');
                linkageTagEl.textContent = `${species.linkage} Linkage`;
                linkageTagEl.classList.add(...linkageInfo.color.split(' '));

                card.querySelector('.category-tag').textContent = species.category.split(' ')[0];

                const stateTagsContainer = card.querySelector('.state-tags');
                const stateTagsHTML = species.states.map(s => `<span class="inline-block bg-slate-200 text-slate-700 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full">${s}</span>`).join('');
                stateTagsContainer.innerHTML = stateTagsHTML;

                // Add the event listener to the main div of the card
                card.querySelector('.card').addEventListener('click', () => showModal(species));
                card.querySelector('.card').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') showModal(species); });
                
                // Add the completed card to the grid
                speciesGrid.appendChild(card);
            });
        }    
        
        function renderAccordion() {
            accordionContainer.innerHTML = '';
            recommendationsData.forEach((item) => {
                const accordionItem = document.createElement('div');
                accordionItem.className = 'bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden';
                accordionItem.innerHTML = `<button class="accordion-header w-full text-left p-4 font-semibold text-slate-800 flex justify-between items-center hover:bg-slate-50 focus:outline-none"><span class="pr-2">${item.title}</span><span class="transform transition-transform duration-300">▾</span></button><div class="accordion-content overflow-hidden max-h-0 transition-max-height duration-500 ease-in-out"><div class="p-4 border-t border-slate-200">${item.content}</div></div>`;
                accordionContainer.appendChild(accordionItem);
            });
            document.querySelectorAll('.accordion-header').forEach(button => {
                button.addEventListener('click', () => {
                    const content = button.nextElementSibling;
                    button.querySelector('span:last-child').classList.toggle('rotate-180');
                    if (content.style.maxHeight) {
                        content.style.maxHeight = null;
                    } else {
                        content.style.maxHeight = content.scrollHeight + "px";
                    }
                });
            });
        }

        function populateFilters() {
            const categoryHierarchy = {
                'Agro-Commodity': [...new Set(speciesData.filter(s => s.primaryCategory === 'Agro-Commodity').map(s => s.category))].sort(),
                'NTFP': [...new Set(speciesData.filter(s => s.primaryCategory === 'NTFP').map(s => s.category))].sort()
            };
            categoryFilterDropdown.innerHTML = '';
            for (const majorCategory in categoryHierarchy) {
                const majorCatDiv = document.createElement('div');
                majorCatDiv.className = 'mb-3';
                const majorLabel = document.createElement('label');
                majorLabel.className = 'flex items-center space-x-2 font-bold text-blue-900 cursor-pointer';
                const majorCheckbox = document.createElement('input');
                majorCheckbox.type = 'checkbox';
                majorCheckbox.className = 'major-checkbox rounded';
                majorCheckbox.dataset.major = majorCategory;
                majorLabel.appendChild(majorCheckbox);
                majorLabel.appendChild(document.createTextNode(majorCategory));
                majorCatDiv.appendChild(majorLabel);
                const subCatContainer = document.createElement('div');
                subCatContainer.className = 'pl-6 mt-1 space-y-1';
                categoryHierarchy[majorCategory].forEach(subCategory => {
                    const subLabel = document.createElement('label');
                    subLabel.className = 'flex items-center space-x-2 text-slate-700 font-normal cursor-pointer';
                    const subCheckbox = document.createElement('input');
                    subCheckbox.type = 'checkbox';
                    subCheckbox.value = subCategory;
                    subCheckbox.className = 'sub-checkbox rounded';
                    subCheckbox.dataset.parent = majorCategory;
                    subLabel.appendChild(subCheckbox);
                    subLabel.appendChild(document.createTextNode(subCategory));
                    subCatContainer.appendChild(subLabel);
                });
                majorCatDiv.appendChild(subCatContainer);
                categoryFilterDropdown.appendChild(majorCatDiv);
            }
        }

        // --- MODAL LOGIC ---
        function showModal(species) {
            modalTitle.textContent = species.name;
            let productsHtml = species.products.map(p => `<li class="text-slate-600">${p}</li>`).join('');
            let sourcesHtml = '';
            if (species.sources && species.sources.length > 0) {
                const sourceLinks = species.sources.map(source => `<li><a href="${source.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${source.name}</a></li>`).join('');
                sourcesHtml = `<h5 class="font-bold text-slate-800 mb-2 mt-4">Source(s)</h5><ul class="list-disc list-inside space-y-1">${sourceLinks}</ul>`;
            }
            modalBody.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p class="text-sm text-slate-500 italic mb-4">${species.botanical}</p>
                        <h5 class="font-bold text-slate-800 mb-2">Core Strength & Market Driver</h5>
                        <p class="text-slate-600 mb-4">${species.strength}</p>
                        <h5 class="font-bold text-slate-800 mb-2">Key Value-Added Products</h5>
                        <ul class="list-disc list-inside space-y-1 mb-4">${productsHtml}</ul>
                        <h5 class="font-bold text-slate-800 mb-2">Strategic Intervention Priority: <span class="text-blue-700">${species.linkage}</span></h5>
                        <p class="text-slate-600">${species.justification}</p>
                        ${sourcesHtml}
                    </div>
                    <div class="flex items-center justify-center min-h-[250px] bg-slate-50 rounded-lg p-4">
                        ${species.chartData ? `<div class="chart-container relative h-64 md:h-80 w-full max-w-md mx-auto"><canvas id="modalChartCanvas"></canvas></div>` : '<div class="text-center text-slate-500"><p>No specific quantitative data available for visualization.</p></div>'}
                    </div>
                </div>`;
            document.body.classList.add('modal-open');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => { modal.querySelector('.modal-content').classList.remove('scale-95'); modal.classList.remove('opacity-0'); }, 10);
            if (species.chartData) {
                const ctx = document.getElementById('modalChartCanvas').getContext('2d');
                if (modalChart) modalChart.destroy();
                modalChart = new Chart(ctx, { type: species.chartData.type, data: { labels: species.chartData.labels, datasets: [{ label: 'Tonnes', data: species.chartData.values, backgroundColor: ['rgba(59, 130, 246, 0.5)', 'rgba(239, 68, 68, 0.5)'], borderColor: ['rgba(59, 130, 246, 1)', 'rgba(239, 68, 68, 1)'], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: species.chartData.title, font: { size: 14 } } }, scales: { y: { beginAtZero: true } } } });
            }
        }
        function hideModal() {
            document.body.classList.remove('modal-open');
            modal.querySelector('.modal-content').classList.add('scale-95');
            modal.classList.add('opacity-0');
            setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); if (modalChart) { modalChart.destroy(); modalChart = null; } }, 300);
        }

        // --- FILTERING LOGIC ---
        function applyFilters() {
            const checkedCategories = Array.from(document.querySelectorAll('#categoryFilterDropdown .sub-checkbox:checked')).map(cb => cb.value);
            const link = linkageFilterGroup.querySelector('.active-filter').dataset.value;
            const state = stateFilterGroup.querySelector('.active-filter').dataset.value;
            const filtered = speciesData.filter(s => {
                const categoryMatch = checkedCategories.length === 0 || checkedCategories.includes(s.category);
                const linkageMatch = link === 'all' || s.linkage === link;
                const stateMatch = state === 'all' || s.states.includes(state);
                return categoryMatch && linkageMatch && stateMatch;
            });
            renderSpecies(filtered);
        }

        // --- DASHBOARD CHARTS & METRICS ---
        function updateSummaryMetrics() {
            const total = speciesData.length;
            speciesCountEl.textContent = total;
            const backwardCount = speciesData.filter(s => s.linkage === 'Backward').length;
            const forwardCount = speciesData.filter(s => s.linkage === 'Forward').length;
            const integratedCount = total - backwardCount - forwardCount;
            backwardLinkagePercentEl.textContent = `${Math.round((backwardCount / total) * 100)}%`;
            forwardLinkagePercentEl.textContent = `${Math.round((forwardCount / total) * 100)}%`;
            integratedLinkagePercentEl.textContent = `${Math.round((integratedCount / total) * 100)}%`;
        }

        function renderDashboardCharts() {
            // Linkage Chart
            const linkageCounts = speciesData.reduce((acc, curr) => { acc[curr.linkage] = (acc[curr.linkage] || 0) + 1; return acc; }, {});
            const sortedLinkageLabels = Object.keys(linkageCounts).sort();
            const sortedLinkageValues = sortedLinkageLabels.map(label => linkageCounts[label]);
            new Chart(document.getElementById('linkageChart').getContext('2d'), { type: 'doughnut', data: { labels: sortedLinkageLabels, datasets: [{ data: sortedLinkageValues, backgroundColor: ['rgba(239, 68, 68, 0.7)', 'rgba(34, 197, 94, 0.7)', 'rgba(59, 130, 246, 0.7)'], borderColor: ['#fff'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, datalabels: { formatter: (v) => v, color: '#fff', font: { weight: 'bold', size: 16 } } } } });
            // State Chart
            const stateCounts = { 'Rajasthan': 0, 'Haryana': 0, 'Delhi': 0 };
            speciesData.forEach(s => s.states.forEach(state => { if (state in stateCounts) stateCounts[state]++; }));
            new Chart(document.getElementById('stateChart').getContext('2d'), { type: 'bar', data: { labels: Object.keys(stateCounts), datasets: [{ data: Object.values(stateCounts), backgroundColor: ['rgba(236, 72, 153, 0.7)', 'rgba(34, 197, 94, 0.7)', 'rgba(59, 130, 246, 0.7)'] }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, title: { display: true, text: 'Number of Species' } } } } });
            // Category Pie Chart
            const productCategories = { 'Processed Food': ['Candy', 'murabba', 'Pickles', 'Jam', 'Jelly', 'Chutney', 'Sauce', 'Ketchup', 'gajar murabba', 'gunda', 'ladoos', 'snacks', 'pattal', 'biscuit', 'bread', 'vermicelli'], 'Extracts & Oils': ['extracts', 'oil', 'Essential oil', 'Oleoresins', 'guggulsterones', 'boswellic acids', 'thymol', 'Papain', 'Lutein', 'concrete', 'absolute', 'attar'], 'Powders & Flours': ['Powders', 'Powder', 'Flour', 'atta', 'suji', 'besan', 'cake'], 'Beverages': ['Juice', 'beverages', 'squash', 'drinks', 'wine', 'beer'], 'Health & Wellness': ['Capsules', 'supplements', 'tonic', 'Chyawanprash', 'miswak', 'gulkand'], 'Raw & Graded Produce': ['seeds', 'arils', 'fruit', 'vegetable', 'flowers', 'leaves', 'pods', 'florets', 'cloves', 'spikes', 'bulbs', 'tubers', 'roots'], 'Timber & Fiber': ['timber', 'Plywood', 'Pulpwood', 'Veneer', 'charcoal', 'briquettes', 'floss', 'kapok'], 'Industrial Products': ['gum', 'wax', 'Tannin', 'dyes', 'starch', 'oleochemical'], 'Animal Feed & Fodder': ['fodder', 'Hay', 'Silage', 'feed'] };
            const categoryCounts = {};
            speciesData.forEach(s => s.products.forEach(p => { const cat = Object.keys(productCategories).find(c => productCategories[c].some(k => p.toLowerCase().includes(k))) || 'Other'; categoryCounts[cat] = (categoryCounts[cat] || 0) + 1; }));
            const sortedCategories = Object.entries(categoryCounts).sort(([,a],[,b]) => b-a);
            const topN = 6;
            const topCategories = sortedCategories.slice(0, topN);
            const otherCount = sortedCategories.slice(topN).reduce((sum, [,count]) => sum + count, 0);
            const pieChartLabels = topCategories.map(([name]) => name);
            const pieChartData = topCategories.map(([,count]) => count);
            if (otherCount > 0) { pieChartLabels.push('Other'); pieChartData.push(otherCount); }
            new Chart(document.getElementById('categoryPieChart').getContext('2d'), { type: 'pie', data: { labels: pieChartLabels, datasets: [{ data: pieChartData, backgroundColor: ['#4f46e5', '#db2777', '#16a34a', '#d97706', '#0891b2', '#6d28d9', '#64748b'], borderColor: 'white', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 15, font: { size: 11 } } }, datalabels: { formatter: (v, c) => { const p = (v / c.chart.getDatasetMeta(0).total * 100); return p > 6 ? p.toFixed(0) + '%' : ''; }, color: '#fff', font: { weight: 'bold' } } } } });
        }

        // --- EVENT LISTENERS ---
        linkageFilterGroup.addEventListener('click', (e) => handleFilterButtonClick(e, linkageFilterGroup));
        stateFilterGroup.addEventListener('click', (e) => handleFilterButtonClick(e, stateFilterGroup));
        function handleFilterButtonClick(event, groupElement) {
            const clickedButton = event.target.closest('button');
            if (!clickedButton) return;
            groupElement.querySelectorAll('button').forEach(button => { button.classList.remove('active-filter'); button.classList.add('inactive-filter'); });
            clickedButton.classList.add('active-filter');
            clickedButton.classList.remove('inactive-filter');
            applyFilters();
        }
        categoryFilterDropdown.addEventListener('change', (e) => {
            if (e.target.classList.contains('major-checkbox')) {
                const majorCat = e.target.dataset.major;
                categoryFilterDropdown.querySelectorAll(`.sub-checkbox[data-parent="${majorCat}"]`).forEach(sub => sub.checked = e.target.checked);
            }
            applyFilters();
        });
        categoryFilterButton.addEventListener('click', (e) => { e.stopPropagation(); categoryFilterDropdown.classList.toggle('show'); });
        document.addEventListener('click', (e) => { if (!categoryFilterDropdown.contains(e.target) && !categoryFilterButton.contains(e.target)) { categoryFilterDropdown.classList.remove('show'); } });
        closeModalBtn.addEventListener('click', hideModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) hideModal(); });
        
        // --- INITIALIZE THE APP ---
        updateSummaryMetrics();
        populateFilters();
        renderSpecies(speciesData);
        renderAccordion();
        renderDashboardCharts();
    }

    // Start the whole process
    main();
});