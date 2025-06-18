// Bootstrap functionality for options page
document.addEventListener('DOMContentLoaded', function() {
  // Initialize Bootstrap collapse functionality
  const companyHelpBtn = document.getElementById('companyHelpBtn');
  const companyHelp = document.getElementById('companyHelp');
  const helpBtnText = document.getElementById('helpBtnText');
  
  if (companyHelpBtn && companyHelp) {
    let isExpanded = false;
    
    // Add click event listener
    companyHelpBtn.addEventListener('click', function() {
      // Check if Bootstrap collapse is working
      if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
        // Bootstrap is loaded, let it handle the collapse
        const bsCollapse = new bootstrap.Collapse(companyHelp, {
          toggle: false
        });
        
        if (isExpanded) {
          bsCollapse.hide();
        } else {
          bsCollapse.show();
        }
        return;
      }
      
      // Fallback: manual toggle
      if (!isExpanded) {
        companyHelp.style.display = 'block';
        companyHelp.classList.add('show');
        helpBtnText.textContent = 'Hide Help - How to find Company ID';
        companyHelpBtn.setAttribute('aria-expanded', 'true');
        isExpanded = true;
      } else {
        companyHelp.style.display = 'none';
        companyHelp.classList.remove('show');
        helpBtnText.textContent = 'Show Help - How to find Company ID';
        companyHelpBtn.setAttribute('aria-expanded', 'false');
        isExpanded = false;
      }
    });
    
    // Listen for Bootstrap collapse events to update button text
    if (companyHelp.addEventListener) {
      companyHelp.addEventListener('shown.bs.collapse', function() {
        helpBtnText.textContent = 'Hide Help - How to find Company ID';
        isExpanded = true;
      });
      
      companyHelp.addEventListener('hidden.bs.collapse', function() {
        helpBtnText.textContent = 'Show Help - How to find Company ID';
        isExpanded = false;
      });
    }
  }
});
