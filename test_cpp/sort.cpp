#include<bits/stdc++.h>
using namespace std;
#define all(v) v.begin(), v.end()

void fsort(int n, vector< int > &v){
    for(int i = 0; i < n; ++i){
        for(int j = 0; j < n - i - 1; ++j){
            if(v[j + 1] < v[j]) swap(v[j + 1], v[j]);
    
        }
    }
}
int main(){
    int n = 10;
    vector< int > v(n);
    iota(all(v), 1);
    random_shuffle(all(v));
    fsort(n, v);
}
